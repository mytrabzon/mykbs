/**
 * KBS Prime - Evrensel MRZ OCR (Tesseract optimizasyonu, özgün)
 * Sadece MRZ karakterleri (A-Z, 0-9, <), PSM 6. Worker ile çoklu deneme.
 */

const Tesseract = require('tesseract.js');
const Jimp = require('jimp');

const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const TESSERACT_OPTIONS = {
  logger: () => {},
  tessedit_pageseg_mode: '6',
  tessedit_char_whitelist: MRZ_WHITELIST,
};

class UniversalOcr {
  constructor() {
    this.worker = null;
  }

  async initialize() {
    this.worker = await Tesseract.createWorker();
    await this.worker.loadLanguage('eng');
    await this.worker.initialize('eng');
    await this.worker.setParameters(TESSERACT_OPTIONS);
    return this;
  }

  /**
   * Görüntü buffer'dan MRZ metnini oku.
   * @param {Buffer} imageBuffer
   * @returns {Promise<string>}
   */
  async readMrz(imageBuffer) {
    if (!this.worker) await this.initialize();
    const { data } = await this.worker.recognize(imageBuffer);
    return (data.text || '').trim();
  }

  /**
   * MRZ benzeri metni puanla (satır sayısı, P/I başlangıç, < sayısı, uzunluk).
   */
  scoreMrz(text) {
    if (!text || typeof text !== 'string') return 0;
    let score = 0;
    const lines = text
      .split(/\r\n|\r|\n/)
      .map((l) => l.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, ''))
      .filter((l) => l.length > 20);

    if (lines.length === 2 || lines.length === 3) score += 20;
    if (lines[0] && /^[PI]/.test(lines[0])) score += 10;
    const fillerCount = (text.match(/</g) || []).length;
    if (fillerCount > 10) score += 10;
    lines.forEach((line) => {
      if (line.length >= 30) score += 5;
      if (line.length >= 44) score += 5;
    });
    const digitCount = (text.match(/[0-9]/g) || []).length;
    const letterCount = (text.match(/[A-Z]/g) || []).length;
    if (digitCount > 10) score += 10;
    if (letterCount > 10) score += 10;
    return score;
  }

  /**
   * Çoklu ön işleme ile deneme; en yüksek skorlu metni döndür.
   * preprocessVariants: Jimp görüntü dizisi (getBufferAsync ile buffer alınır).
   */
  async readWithMultipleAttempts(preprocessVariants, maxAttempts = 3) {
    let bestResult = null;
    let bestScore = 0;

    const attempts = Math.min(maxAttempts, preprocessVariants.length);
    for (let i = 0; i < attempts; i++) {
      try {
        const processed = preprocessVariants[i];
        const buf =
          processed && typeof processed.getBufferAsync === 'function'
            ? await processed.getBufferAsync(Jimp.MIME_JPEG)
            : Buffer.isBuffer(processed)
              ? processed
              : null;
        if (!buf) continue;
        const text = await this.readMrz(buf);
        const score = this.scoreMrz(text);
        if (score > bestScore) {
          bestScore = score;
          bestResult = text;
        }
      } catch (_) {
        // skip failed attempt
      }
    }
    return { text: bestResult || '', confidence: Math.min(95, 50 + bestScore) };
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

module.exports = { UniversalOcr, TESSERACT_OPTIONS, MRZ_WHITELIST };
