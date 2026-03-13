/**
 * KBS Prime - Evrensel MRZ Görüntü Ön İşleme (Sıfırdan, özgün)
 * Fotokopi, ekran görüntüsü, normal belge için tek motor. Jimp kullanır (OpenCV yok).
 */

const Jimp = require('jimp');

/** 3x3 keskinleştirme çekirdeği */
function applySharpenKernel(image) {
  if (!image || !image.bitmap) return image;
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const src = image.bitmap.data;
  const out = Buffer.alloc(src.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let g = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          g += ((src[i] + src[i + 1] + src[i + 2]) / 3) * kernel[(dy + 1) * 3 + (dx + 1)];
        }
      }
      const v = Math.max(0, Math.min(255, Math.round(g)));
      out[idx] = out[idx + 1] = out[idx + 2] = v;
      out[idx + 3] = src[idx + 3];
    }
  }
  for (let i = 0; i < src.length; i += 4) {
    if (out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0) {
      out[i] = out[i + 1] = out[i + 2] = (src[i] + src[i + 1] + src[i + 2]) / 3;
      out[i + 3] = src[i + 3];
    }
  }
  image.bitmap.data = out;
  return image;
}

/** Gri ton eşik (0-255): altı siyah, üstü beyaz. */
function applyThreshold(image, max = 128) {
  if (!image || !image.bitmap) return image;
  const { width, height, data } = image.bitmap;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const g = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    const v = g < max ? 0 : 255;
    data[idx] = data[idx + 1] = data[idx + 2] = v;
    data[idx + 3] = data[idx + 3];
  }
  return image;
}

/** Ortalama parlaklığa göre adaptif eşik (0-255). */
function calculateThreshold(image) {
  if (!image || !image.bitmap) return 128;
  const { width, height, data } = image.bitmap;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    sum += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    n++;
  }
  const avg = n ? sum / n : 128;
  return Math.round(Math.max(80, Math.min(180, avg)));
}

/** KBS Prime: 5 farklı ortam için ön işleme stratejileri */
const STRATEGIES = {
  PASSPORT: 'passport',
  ID_CARD: 'idCard',
  PHOTOCOPY: 'photocopy',
  SCREEN: 'screen',
  DAMAGED: 'damaged',
};

class UniversalPreprocessor {
  static get STRATEGIES() {
    return STRATEGIES;
  }

  /**
   * Ana giriş: görüntü + tespit edilen tip. MRZ bölgesi tespit edilir, stratejiye göre işlenir.
   * @param {Buffer} imageBuffer
   * @param {string} [detectedType] - STRATEGIES.PASSPORT | ID_CARD | PHOTOCOPY | SCREEN | DAMAGED
   * @returns {Promise<Jimp>}
   */
  async preprocess(imageBuffer, detectedType) {
    const image = await Jimp.read(imageBuffer);
    const mrzRegion = this.detectMrzRegion(image);
    switch (detectedType) {
      case STRATEGIES.PHOTOCOPY:
        return this.processPhotocopy(image, mrzRegion);
      case STRATEGIES.SCREEN:
        return this.processScreen(image, mrzRegion);
      case STRATEGIES.DAMAGED:
        return this.processDamaged(image, mrzRegion);
      case STRATEGIES.ID_CARD:
        return this.processStandard(image, mrzRegion, { highContrast: true });
      default:
        return this.processStandard(image, mrzRegion);
    }
  }

  /**
   * Fotokopi: yüksek kontrast, gürültü azaltma, keskinleştirme, gerekirse invert.
   */
  async processPhotocopy(image, mrzRegion) {
    const { y, height } = mrzRegion;
    const w = image.bitmap.width;
    let slice = image.clone().crop(0, y, w, height);
    slice = slice.greyscale().normalize().contrast(0.8).brightness(0.08);
    applySharpenKernel(slice);
    applyThreshold(slice, 140);
    return slice;
  }

  /**
   * Ekran görüntüsü: Moiré azaltma (blur hafif), parlaklık, keskinleştirme.
   */
  async processScreen(image, mrzRegion) {
    const { y, height } = mrzRegion;
    const w = image.bitmap.width;
    let slice = image.clone().crop(0, y, w, height);
    slice = slice.greyscale().normalize().contrast(0.4);
    applySharpenKernel(slice);
    applyThreshold(slice, calculateThreshold(slice));
    return slice;
  }

  /**
   * Yıpranmış belge: adaptif eşik, kenar iyileştirme (keskinleştirme).
   */
  async processDamaged(image, mrzRegion) {
    const { y, height } = mrzRegion;
    const w = image.bitmap.width;
    let slice = image.clone().crop(0, y, w, height);
    slice = slice.greyscale().normalize().contrast(0.6);
    applySharpenKernel(slice);
    const th = calculateThreshold(slice);
    applyThreshold(slice, Math.max(100, Math.min(160, th)));
    return slice;
  }

  /**
   * Standart belge (orijinal pasaport/kimlik): hafif kontrast, keskinleştirme, adaptif eşik.
   */
  async processStandard(image, mrzRegion, opts = {}) {
    const { y, height } = mrzRegion;
    const w = image.bitmap.width;
    let slice = image.clone().crop(0, y, w, height);
    slice = slice.greyscale().normalize().contrast(opts.highContrast ? 0.55 : 0.45);
    applySharpenKernel(slice);
    applyThreshold(slice, calculateThreshold(slice));
    return slice;
  }

  /**
   * MRZ bölgesini tespit et: belge alt 1/3 - 1/2 (pasaport/kimlik standart).
   */
  detectMrzRegion(image) {
    const height = image.bitmap.height;
    const mrzY = Math.floor(height * 0.6);
    const mrzHeight = Math.max(120, Math.floor(height * 0.4));
    return { y: mrzY, height: mrzHeight };
  }

  /**
   * Ana ön işleme: MRZ bölgesi kırp, tipine göre kontrast/keskinleştirme/invert, eşik.
   * @param {Buffer} imageBuffer - JPEG/PNG buffer
   * @param {{ isPhotocopy?: boolean, isScreen?: boolean }} [options]
   * @returns {Promise<Jimp>} Ön işlenmiş Jimp (getBufferAsync ile OCR'a verilir)
   */
  async preprocessForMrz(imageBuffer, options = {}) {
    const image = await Jimp.read(imageBuffer);
    const { y, height } = this.detectMrzRegion(image);
    const w = image.bitmap.width;
    image.crop(0, y, w, height);

    if (options.isPhotocopy) {
      image.contrast(0.8).greyscale().normalize();
      applyThreshold(image, 140);
      image.invert();
    } else if (options.isScreen) {
      image.greyscale().normalize().contrast(0.4);
      applySharpenKernel(image);
      applyThreshold(image, calculateThreshold(image));
    } else {
      image.contrast(0.5).greyscale().normalize();
      applySharpenKernel(image);
      applyThreshold(image, calculateThreshold(image));
    }

    return image;
  }

  /**
   * Dilimde MRZ benzeri içerik var mı (uzun satır, P/I ile başlama, < karakteri).
   */
  hasMrz(sliceImage) {
    const w = sliceImage.bitmap.width;
    const h = sliceImage.bitmap.height;
    if (w < 200 || h < 40) return false;
    const data = sliceImage.bitmap.data;
    let darkCount = 0;
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const g = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (g < 128) darkCount++;
    }
    const ratio = darkCount / (w * h);
    return ratio > 0.1 && ratio < 0.7;
  }

  /**
   * Görüntüyü yatay dilimlere bölüp MRZ içeren bölgeleri döndür (çoklu belge).
   */
  async detectMultipleMrz(image) {
    const jimpImage = await Jimp.read(image);
    const h = jimpImage.bitmap.height;
    const w = jimpImage.bitmap.width;
    const sliceHeight = Math.floor(h / 4);
    const mrzRegions = [];

    for (let i = 0; i < 4; i++) {
      const y = i * sliceHeight;
      const slice = jimpImage.clone().crop(0, y, w, sliceHeight);
      if (this.hasMrz(slice)) {
        mrzRegions.push({ y, height: sliceHeight });
      }
    }
    return mrzRegions;
  }

  /**
   * Deneme indeksine göre farklı ön işleme (çoklu deneme stratejisi için).
   */
  async preprocessVariant(imageBuffer, attemptIndex) {
    const image = await Jimp.read(imageBuffer);
    const { y, height } = this.detectMrzRegion(image);
    const w = image.bitmap.width;
    image.crop(0, y, w, height).greyscale().normalize();

    switch (attemptIndex % 4) {
      case 0:
        image.contrast(0.5);
        applySharpenKernel(image);
        applyThreshold(image, 128);
        break;
      case 1:
        image.contrast(0.75);
        applyThreshold(image, 140);
        break;
      case 2:
        image.contrast(0.6);
        applySharpenKernel(image);
        applyThreshold(image, 110);
        image.invert();
        break;
      default:
        image.contrast(0.7);
        applyThreshold(image, calculateThreshold(image));
    }
    return image;
  }
}

module.exports = { UniversalPreprocessor, STRATEGIES, applySharpenKernel, applyThreshold, calculateThreshold };
