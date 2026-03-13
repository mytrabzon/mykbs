/**
 * KBS Prime - HMS benzeri kağıt/fotokopi MRZ okuyucu.
 * Çoklu ön işleme stratejisi, farklı DPI, skorlama ve ICAO 9303 validasyonu.
 */

const { runOcrOnBuffer, extractMrzFromOcr } = require('./mrz');
const { UniversalMrzParser } = require('../mrz/universalMrzParser');

const DEFAULT_DPI = 72;
let _jimpPromise = null;

class PaperMrzProcessor {
  constructor() {
    this.strategies = [
      'original',
      'highContrast',
      'denoise',
      'sharpen',
      'negative',
      'adaptiveThreshold',
      'morphological',
    ];
    this.resolutions = [300, 600, 800]; // 1200 DPI çok büyük buffer; 800 yeterli
    this.maxSidePx = 2400; // Bellek için üst sınır
  }

  /**
   * Ana fonksiyon: tüm DPI ve stratejileri dene, en iyi skorlu sonucu seç.
   * @param {Buffer} imageBuffer
   * @returns {Promise<{ text, confidence, strategy, resolution, validation, score }>}
   */
  async processPaperMrz(imageBuffer) {
    const attempts = [];
    const J = await this._getJimp();

    for (const dpi of this.resolutions) {
      const resized = await this.resizeForDPI(imageBuffer, dpi, J);
      const buffers = await this.tryAllStrategies(resized, J);
      for (const { buffer, strategy } of buffers) {
        const ocrText = await runOcrOnBuffer(buffer);
        const raw = extractMrzFromOcr(ocrText);
        if (!raw || raw.length < 20) continue;
        const score = this.calculateScore(raw);
        attempts.push({
          text: raw,
          confidence: Math.min(100, score),
          strategy,
          resolution: dpi,
          score,
        });
      }
    }

    const best = this.selectBestResult(attempts);
    const validation = this.validateMrz(best.text);

    return {
      text: best.text,
      confidence: best.confidence,
      strategy: best.strategy,
      resolution: best.resolution,
      validation,
      score: best.score,
    };
  }

  async _getJimp() {
    if (!_jimpPromise) _jimpPromise = import('jimp').then((m) => m.default);
    return _jimpPromise;
  }

  /**
   * Görüntüyü hedef DPI'ye ölçekle (varsayılan 72 DPI kabul).
   */
  async resizeForDPI(imageBuffer, targetDPI, J) {
    const img = await J.read(imageBuffer);
    let w = img.bitmap.width;
    let h = img.bitmap.height;
    let scale = targetDPI / DEFAULT_DPI;
    let nw = Math.round(w * scale);
    let nh = Math.round(h * scale);
    if (nw > this.maxSidePx || nh > this.maxSidePx) {
      const s = Math.min(this.maxSidePx / nw, this.maxSidePx / nh);
      nw = Math.round(nw * s);
      nh = Math.round(nh * s);
    }
    if (scale <= 1 && nw <= w && nh <= h) return imageBuffer;
    const resized = img.resize(nw, nh, J.RESIZE_BICUBIC);
    return resized.getBufferAsync(J.MIME_JPEG);
  }

  /**
   * Tüm stratejileri uygula, her biri için buffer döndür (OCR bu buffer üzerinde yapılacak).
   */
  async tryAllStrategies(imageBuffer, J) {
    const results = [];
    const img = await J.read(imageBuffer);

    for (const strategy of this.strategies) {
      try {
        const processed = await this.applyStrategy(img.clone(), strategy, J);
        const buf = await processed.getBufferAsync(J.MIME_JPEG);
        results.push({ buffer: buf, strategy });
      } catch (e) {
        // Strateji atlanır
      }
    }
    return results;
  }

  /**
   * Tek strateji uygula. image: Jimp instance (değiştirilebilir).
   */
  async applyStrategy(image, strategy, J) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const mrzH = Math.floor(h * 0.45);
    const y = Math.max(0, h - mrzH);
    // MRZ genelde altta; alt bölgeyi kırp (opsiyonel, tam sayfa da deneyebiliriz)
    let crop = image;
    if (h > 200) {
      crop = image.crop(0, y, w, mrzH);
    }

    switch (strategy) {
      case 'original':
        return crop.contrast(0.5).greyscale();

      case 'highContrast':
        return crop
          .contrast(0.9)
          .greyscale()
          .convolute([
            [0, -1, 0],
            [-1, 5, -1],
            [0, -1, 0],
          ]);

      case 'denoise':
        return crop.greyscale().normalize().contrast(0.4);

      case 'sharpen':
        return crop
          .greyscale()
          .convolute([
            [-1, -1, -1],
            [-1, 9, -1],
            [-1, -1, -1],
          ]);

      case 'negative':
        return crop.greyscale().invert().contrast(0.7);

      case 'adaptiveThreshold': {
        crop.greyscale();
        const thresh = this.otsuThresholdFromImage(crop);
        crop.scan(0, 0, crop.bitmap.width, crop.bitmap.height, (x, y, idx) => {
          const g = (crop.bitmap.data[idx] + crop.bitmap.data[idx + 1] + crop.bitmap.data[idx + 2]) / 3;
          const v = g <= thresh ? 0 : 255;
          crop.bitmap.data[idx] = crop.bitmap.data[idx + 1] = crop.bitmap.data[idx + 2] = v;
        });
        return crop;
      }

      case 'morphological': {
        crop.greyscale().contrast(0.6);
        const thresh = this.otsuThresholdFromImage(crop);
        const bin = this.binarize(crop, thresh);
        const dilated = this.dilate3x3(bin);
        const eroded = this.erode3x3(dilated);
        const { width, height } = crop.bitmap;
        const d = crop.bitmap.data;
        for (let i = 0; i < eroded.data.length; i++) {
          const v = eroded.data[i] ? 255 : 0;
          d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
        }
        return crop;
      }

      default:
        return crop.greyscale();
    }
  }

  getHistogram(image) {
    const hist = new Array(256).fill(0);
    const { data, width, height } = image.bitmap;
    for (let i = 0; i < width * height * 4; i += 4) {
      const g = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
      hist[g]++;
    }
    return hist;
  }

  otsuThreshold(histogram) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i];
    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVar = 0;
    let threshold = 0;
    const totalPixels = histogram.reduce((a, b) => a + b, 0);
    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;
      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const varBetween = wB * wF * (mB - mF) * (mB - mF);
      if (varBetween > maxVar) {
        maxVar = varBetween;
        threshold = t;
      }
    }
    return threshold;
  }

  otsuThresholdFromImage(image) {
    const hist = this.getHistogram(image);
    return this.otsuThreshold(hist);
  }

  binarize(image, threshold) {
    const { data, width, height } = image.bitmap;
    const out = [];
    for (let i = 0; i < width * height * 4; i += 4) {
      const g = (data[i] + data[i + 1] + data[i + 2]) / 3;
      out.push(g <= threshold ? 0 : 1);
    }
    return { data: out, width, height };
  }

  dilate3x3(bin) {
    const { data, width, height } = bin;
    const out = data.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        let max = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) max = Math.max(max, data[(y + dy) * width + (x + dx)]);
        out[idx] = max;
      }
    }
    return { data: out, width, height };
  }

  erode3x3(bin) {
    const { data, width, height } = bin;
    const out = data.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        let min = 1;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) min = Math.min(min, data[(y + dy) * width + (x + dx)]);
        out[idx] = min;
      }
    }
    return { data: out, width, height };
  }

  /**
   * MRZ kalitesi skoru (HMS benzeri).
   */
  calculateScore(text) {
    if (!text || typeof text !== 'string') return 0;
    let score = 0;
    const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().replace(/\s/g, '')).filter((l) => l.length > 10);

    if (lines.length === 2 || lines.length === 3) score += 30;
    if (lines[0] && /^[PI]/.test(lines[0])) score += 20;
    const fillerCount = (text.match(/</g) || []).length;
    if (fillerCount > 10) score += 15;
    const digitCount = (text.match(/[0-9]/g) || []).length;
    if (digitCount > 15) score += 15;
    lines.forEach((line) => {
      if (line.length === 30) score += 5;
      if (line.length === 36) score += 5;
      if (line.length === 44) score += 5;
    });

    try {
      const parsed = UniversalMrzParser.parse(text);
      if (parsed && parsed.format && parsed.format !== 'UNKNOWN') score += 20;
    } catch (_) {}

    return score;
  }

  /**
   * ICAO 9303 checksum: satır sonundaki kontrol rakamı.
   */
  verifyLineChecksum(line) {
    if (!line || line.length < 2) return false;
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const char = line[i];
      let value;
      if (char === '<') value = 0;
      else if (/[0-9]/.test(char)) value = parseInt(char, 10);
      else if (/[A-Z]/.test(char)) value = char.charCodeAt(0) - 55;
      else return false;
      sum += value * weights[i % 3];
    }
    const expected = line[line.length - 1];
    const calculated = (sum % 10).toString();
    return expected === calculated;
  }

  validateChecksum(text) {
    const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().replace(/\s/g, '')).filter((l) => l.length >= 20);
    for (const line of lines) {
      if (line.length < 28) continue;
      if (!this.verifyLineChecksum(line)) return false;
    }
    return lines.length >= 2;
  }

  validateFormat(lines) {
    if (!lines || lines.length < 2) return false;
    const l0 = lines[0].length;
    const l1 = lines[1]?.length || 0;
    if (lines.length === 3 && l0 >= 28 && l0 <= 30) return true;
    if (lines.length === 2 && l0 >= 34 && l0 <= 44 && l1 >= 34 && l1 <= 44) return true;
    if (lines.length === 2 && l0 >= 28 && l0 <= 36 && l1 >= 28 && l1 <= 36) return true;
    return false;
  }

  validateLogical(text) {
    try {
      const parsed = UniversalMrzParser.parse(text);
      return !!(parsed && (parsed.surname || parsed.givenName || parsed.documentNumber));
    } catch (_) {
      return false;
    }
  }

  validateCountryCode(text) {
    const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().replace(/\s/g, '')).filter((l) => l.length > 10);
    if (lines.length < 1) return false;
    const first = lines[0];
    if (first.length >= 5) {
      const code = first.substring(2, 5).replace(/</g, '');
      return /^[A-Z]{3}$/.test(code);
    }
    return true;
  }

  validateDates(text) {
    try {
      const parsed = UniversalMrzParser.parse(text);
      if (!parsed) return false;
      if (parsed.birthDate) {
        const d = new Date(parsed.birthDate);
        if (isNaN(d.getTime()) || d.getFullYear() < 1900 || d.getFullYear() > 2100) return false;
      }
      if (parsed.expiryDate) {
        const d = new Date(parsed.expiryDate);
        if (isNaN(d.getTime())) return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  validateMrz(text) {
    const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().replace(/\s/g, '')).filter((l) => l.length > 10);
    const validation = {
      format: false,
      checksum: false,
      logical: false,
      country: false,
      date: false,
    };
    validation.format = this.validateFormat(lines);
    validation.checksum = this.validateChecksum(text);
    validation.logical = this.validateLogical(text);
    validation.country = this.validateCountryCode(text);
    validation.date = this.validateDates(text);
    validation.passed = Object.values(validation).every((v) => v === true);
    return validation;
  }

  selectBestResult(results) {
    if (!results.length) {
      return {
        text: '',
        confidence: 0,
        strategy: 'none',
        resolution: 0,
        score: 0,
      };
    }
    return results.sort((a, b) => b.score - a.score)[0];
  }
}

module.exports = { PaperMrzProcessor };
