/**
 * Image preprocessing for scan: grayscale, normalize, contrast.
 * Uses Jimp (no OpenCV). For deskew/crop we could add later.
 */

const path = require('path');
const fs = require('fs');

/**
 * Preprocess image for MRZ/OCR: grayscale, normalize, contrast.
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} Same filePath after write
 */
async function preprocessForOcr(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    await image
      .greyscale()
      .normalize()
      .contrast(0.2)
      .write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Fotokopi / kağıt MRZ için güçlü ön işleme: yüksek kontrast, gri ton, gerekirse büyütme ve keskinleştirme.
 * Soluk fotokopide okunabilirliği artırır.
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} Same filePath after write
 */
async function preprocessForPhotocopyMrz(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    image = image.greyscale().normalize().contrast(0.55).brightness(0.08);
    if (w < 900 || h < 300) {
      const scale = Math.min(2.2, 900 / Math.max(w, 1), 350 / Math.max(h, 1));
      if (scale > 1.15) image = image.resize(Math.round(w * scale), Math.round(h * scale), Jimp.RESIZE_BICUBIC);
    }
    image = applySharpenKernel(image);
    await image.write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Fotokopi – çok soluk / düşük kalite için daha agresif ön işleme: yüksek kontrast, parlaklık, büyütme.
 */
async function preprocessForPhotocopyMrzStrong(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    image = image.greyscale().normalize().brightness(0.12).contrast(0.78);
    if (w < 1000 || h < 350) {
      const scale = Math.min(2.5, 1000 / Math.max(w, 1), 400 / Math.max(h, 1));
      if (scale > 1.1) image = image.resize(Math.round(w * scale), Math.round(h * scale), Jimp.RESIZE_BICUBIC);
    }
    image = applySharpenKernel(image);
    await image.write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Load image from base64, preprocess, and optionally save to temp file.
 * @param {string} imageBase64 - JPEG/PNG base64 string
 * @param {string} [tempDir] - Directory for temp file (optional; if not set, returns buffer in memory is not implemented - we write to temp)
 * @param {{ paperMode?: boolean }} [options] - paperMode: kağıt/fotokopi MRZ için güçlü ön işleme (kontrast, keskinleştirme, büyütme)
 * @returns {Promise<{ filePath: string }>} Path to preprocessed image
 */
const PREPROCESS_LOG = '[preprocessFromBase64]';
async function preprocessFromBase64(imageBase64, tempDir, options = {}) {
  let buf;
  try {
    buf = Buffer.from(imageBase64, 'base64');
  } catch (decodeErr) {
    console.warn(PREPROCESS_LOG, "Storage'a yazılmadı: base64 decode hatası. Neden:", decodeErr.message);
    throw new Error('Geçersiz görüntü (base64 format hatası): ' + decodeErr.message);
  }
  if (!buf || buf.length === 0) {
    console.warn(PREPROCESS_LOG, "Storage'a yazılmadı: base64 decode sonrası buffer boş.");
    throw new Error('Invalid image: empty buffer');
  }
  const dir = tempDir || require('os').tmpdir();
  const filename = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
  const filePath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(filePath, buf);
    console.log(PREPROCESS_LOG, "Storage'a yazıldı:", filePath, { bufLen: buf.length, paperMode: !!options.paperMode });
  } catch (writeErr) {
    console.error(PREPROCESS_LOG, "Storage yazma hatası:", writeErr.message, "path:", filePath);
    throw new Error('Görsel kaydedilemedi: ' + writeErr.message);
  }
  await preprocessForOcr(filePath);
  if (options.paperMode) {
    await preprocessForPaperMrz(filePath);
  }
  return { filePath };
}

/**
 * Crop image to bottom fraction. Writes to outPath.
 */
async function cropBottomFraction(filePath, fraction, outPath) {
  if (!filePath || !fs.existsSync(filePath)) return outPath || filePath;
  const out = outPath || filePath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const cropH = Math.max(1, Math.round(h * Math.min(1, Math.max(0, fraction))));
    const y = Math.max(0, h - cropH);
    image.crop(0, y, w, cropH);
    await image.write(out);
    return out;
  } catch (e) {
    return out;
  }
}

/**
 * Crop image to top fraction (MRZ üstte olabilir).
 */
async function cropTopFraction(filePath, fraction, outPath) {
  if (!filePath || !fs.existsSync(filePath)) return outPath || filePath;
  const out = outPath || filePath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const cropH = Math.max(1, Math.round(h * Math.min(1, Math.max(0, fraction))));
    image.crop(0, 0, w, cropH);
    await image.write(out);
    return out;
  } catch (e) {
    return out;
  }
}

/**
 * Crop image to center vertical strip (MRZ ortada olabilir).
 * @param {number} fraction - 0..1, e.g. 0.4 = middle 40% of height
 */
async function cropCenterFraction(filePath, fraction, outPath) {
  if (!filePath || !fs.existsSync(filePath)) return outPath || filePath;
  const out = outPath || filePath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const cropH = Math.max(1, Math.round(h * Math.min(1, Math.max(0, fraction))));
    const y = Math.max(0, Math.round((h - cropH) / 2));
    image.crop(0, y, w, cropH);
    await image.write(out);
    return out;
  } catch (e) {
    return out;
  }
}

/**
 * Kimlik kartı MRZ için ön işleme: grayscale, normalize, yüksek kontrast, 2x upscale (bicubic), isteğe bağlı sharpen.
 * Yansıma/güvenlik deseni azaltır; küçük MRZ bandı için netlik artar.
 */
async function preprocessForKimlikMrz(filePath, options = {}) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  const { upscale = true, sharpen = false, contrast = 0.55 } = options;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    image = image.greyscale().normalize().contrast(contrast);
    if (upscale && (w < 1000 || h < 400)) {
      const scale = Math.min(2.2, 1000 / Math.max(w, 1), 500 / Math.max(h, 1));
      if (scale > 1.05) {
        image = image.resize(Math.round(w * scale), Math.round(h * scale), Jimp.RESIZE_BICUBIC);
      }
    }
    if (sharpen) {
      image = applySharpenKernel(image);
    }
    await image.write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/** Basit 3x3 keskinleştirme çekirdeği (Jimp ile convolution benzeri). */
function applySharpenKernel(image) {
  if (!image || !image.bitmap) return image;
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const src = image.bitmap.data;
  const out = Buffer.alloc(src.length);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const k = 1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let g = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          g += (src[i] + src[i + 1] + src[i + 2]) / 3 * kernel[(dy + 1) * 3 + (dx + 1)];
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

/**
 * A4 kağıt / fotokopi MRZ için ön işleme: yüksek kontrast, gerekirse büyütme ve keskinleştirme.
 * Fotokopide pasaport MRZ genelde soluk; kontrast artırıp Tesseract okunabilirliğini artırır.
 */
async function preprocessForPaperMrz(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    image = image.greyscale().normalize().brightness(0.08).contrast(0.75);
    if (w < 1000 || h < 280) {
      const scale = Math.min(2.4, 1000 / Math.max(w, 1), 500 / Math.max(h, 1));
      if (scale > 1.15) image = image.resize(Math.round(w * scale), Math.round(h * scale), Jimp.RESIZE_BICUBIC);
    }
    image = applySharpenKernel(image);
    await image.write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Soluk / silik baskı MRZ için: çok yüksek kontrast + hafif parlaklık – fotokopi/kağıt baskıda işe yarar.
 */
async function preprocessForFadedMrz(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    image = image.greyscale().normalize().brightness(0.15).contrast(0.85);
    if (w < 800 || h < 200) {
      const scale = Math.min(2.2, 800 / Math.max(w, 1), 400 / Math.max(h, 1));
      if (scale > 1.2) image = image.resize(Math.round(w * scale), Math.round(h * scale), Jimp.RESIZE_BICUBIC);
    }
    await image.write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Ters görüntü (negatif): bazı taramalarda MRZ beyaz zemin üstünde siyah olmayabilir.
 * Renkleri ters çevirip Tesseract için standart siyah-yazı-beyaz-zemin formatına getirir.
 */
async function preprocessForInvertedMrz(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    await image.greyscale().normalize().invert().contrast(0.5).write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * MRZ bölgesi ön işleme: alt kısım crop, kontrast/parlaklık artır, gri ton, keskinleştir.
 * Gölge ve yansımayı azaltıp OCR okunabilirliğini artırır.
 * @param {string} filePath - Görüntü dosya yolu
 * @param {object} [opts] - { mrzFraction: 0.3, contrast: 0.3, brightness: 0.2 }
 * @returns {Promise<string>} filePath
 */
async function preprocessMrzImage(filePath, opts = {}) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  const { mrzFraction = 0.3, contrast = 0.3, brightness = 0.2 } = opts;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const mrzHeight = Math.max(1, Math.floor(h * Math.min(1, Math.max(0.15, mrzFraction))));
    const y = Math.max(0, h - mrzHeight);
    image = image.crop(0, y, w, mrzHeight);
    image = image.greyscale().normalize().contrast(contrast).brightness(brightness);
    image = applySharpenKernel(image);
    await image.write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Görüntünün alt %40'ından 3 farklı alt ROI döndürür (bottom 25%, 30%, 35% of that band).
 * Kimlik MRZ bant konumu değişebildiği için adaptif crop; her biri ayrı dosyaya yazılır.
 * @param {string} filePath - Kaynak görüntü
 * @param {string} dir - Çıktı dosyalarının dizini (genelde os.tmpdir veya upload dir)
 * @returns {Promise<Array<{ path: string, label: string }>>} 3 crop path + label
 */
async function cropMrzCandidates(filePath, dir) {
  if (!filePath || !fs.existsSync(filePath) || !dir) return [];
  const Jimp = (await import('jimp')).default;
  const outDir = path.isAbsolute(dir) ? dir : path.join(require('os').tmpdir(), dir);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = Date.now();
  const results = [];
  try {
    const image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const bandH = Math.max(1, Math.round(h * 0.4));
    const yBand = Math.max(0, h - bandH);
    const band = image.clone().crop(0, yBand, w, bandH);
    const fractions = [0.25, 0.30, 0.35];
    for (let i = 0; i < fractions.length; i++) {
      const frac = fractions[i];
      const cropH = Math.max(1, Math.round(bandH * frac));
      const yCrop = Math.max(0, bandH - cropH);
      const cropped = band.clone().crop(0, yCrop, w, cropH);
      const outPath = path.join(outDir, `mrz_crop_${ts}_bottom${frac}.jpg`);
      await cropped.write(outPath);
      results.push({ path: outPath, label: `bottom${frac}` });
    }
  } catch (e) {
    // ignore
  }
  return results;
}

/**
 * Görüntüyü derece cinsinden döndürür; yeni dosyaya yazar.
 * @param {string} filePath - Kaynak
 * @param {number} degrees - 90, 180, 270 veya deskew için -3, 0, 3
 * @param {string} outPath - Çıktı path
 */
async function rotateImage(filePath, degrees, outPath) {
  if (!filePath || !fs.existsSync(filePath)) return outPath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    const rotated = image.rotate(degrees);
    await rotated.write(outPath || filePath);
    return outPath || filePath;
  } catch (e) {
    return outPath || filePath;
  }
}

/**
 * EXIF / orientation: Jimp EXIF okuyamıyorsa caller pipeline'da 90/180/270 denemesi yapar.
 * Bu fonksiyon sadece verilen path'e rotate uygular (rotateImage ile aynı).
 */
async function applyOrientationRotation(filePath, degrees, outPath) {
  return rotateImage(filePath, degrees, outPath);
}

module.exports = {
  preprocessForOcr,
  preprocessFromBase64,
  preprocessForPhotocopyMrz,
  preprocessForPhotocopyMrzStrong,
  cropBottomFraction,
  cropTopFraction,
  cropCenterFraction,
  preprocessForKimlikMrz,
  preprocessForPaperMrz,
  preprocessForFadedMrz,
  preprocessForInvertedMrz,
  preprocessMrzImage,
  cropMrzCandidates,
  rotateImage,
  applyOrientationRotation,
};
