/**
 * KBS Prime - Tesseract optimizasyonu: 5 farklı görüntü ön işleme stratejisi.
 * MRZ / pasaport / fotokopi için çoklu deneme motoru ile kullanılır.
 */

const Jimp = require('jimp');
const { applyThreshold, calculateThreshold } = require('./universalPreprocess');

/** 3x3 keskinleştirme çekirdeği (Laplacian) */
const SHARPEN_KERNEL = [
  [0, -1, 0],
  [-1, 5, -1],
  [0, -1, 0],
];

/** 3x3 medyan filtre: gürültü azaltma (radius 1 = 3x3 komşuluk). */
function applyMedianFilter(image, radius = 1) {
  if (!image || !image.bitmap) return image;
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const src = image.bitmap.data;
  const out = Buffer.alloc(src.length);
  const size = radius * 2 + 1;
  const kernelSize = size * size;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const values = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = Math.max(0, Math.min(h - 1, y + dy));
          const nx = Math.max(0, Math.min(w - 1, x + dx));
          const i = (ny * w + nx) * 4;
          const g = (src[i] + src[i + 1] + src[i + 2]) / 3;
          values.push(g);
        }
      }
      values.sort((a, b) => a - b);
      const median = values[Math.floor(kernelSize / 2)];
      out[idx] = out[idx + 1] = out[idx + 2] = Math.round(median);
      out[idx + 3] = src[idx + 3];
    }
  }
  image.bitmap.data = out;
  return image;
}

class PreprocessStrategies {
  /** Strateji 1: Orijinal + kontrast + gri ton */
  static async strategyOriginal(image) {
    return image
      .clone()
      .greyscale()
      .normalize()
      .contrast(0.5);
  }

  /** Strateji 2: Yüksek kontrast + keskinleştirme */
  static async strategyHighContrast(image) {
    return image
      .clone()
      .greyscale()
      .normalize()
      .contrast(0.8)
      .convolute(SHARPEN_KERNEL);
  }

  /** Strateji 3: Gürültü azaltma (medyan) + kontrast */
  static async strategyDenoise(image) {
    const cloned = image.clone().greyscale().normalize();
    applyMedianFilter(cloned, 1);
    return cloned.contrast(0.4);
  }

  /** Strateji 4: Negatif (fotokopi / beyaz zemin siyah yazı taramaları) */
  static async strategyNegative(image) {
    return image
      .clone()
      .greyscale()
      .normalize()
      .invert()
      .contrast(0.6);
  }

  /** Strateji 5: Adaptif eşikleme + keskinleştirme */
  static async strategyAdaptive(image) {
    const img = image.clone().greyscale().normalize();
    const th = calculateThreshold(img);
    applyThreshold(img, th);
    return img.convolute(SHARPEN_KERNEL);
  }
}

/** Çoklu deneme motoru için strateji listesi (isim + fn). */
const STRATEGY_LIST = [
  { name: 'original', fn: PreprocessStrategies.strategyOriginal },
  { name: 'highContrast', fn: PreprocessStrategies.strategyHighContrast },
  { name: 'denoise', fn: PreprocessStrategies.strategyDenoise },
  { name: 'negative', fn: PreprocessStrategies.strategyNegative },
  { name: 'adaptive', fn: PreprocessStrategies.strategyAdaptive },
];

module.exports = {
  PreprocessStrategies,
  STRATEGY_LIST,
  applyMedianFilter,
};
