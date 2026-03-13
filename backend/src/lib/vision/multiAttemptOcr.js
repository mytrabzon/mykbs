/**
 * KBS Prime - Çoklu deneme OCR motoru.
 * 5 ön işleme stratejisi × çoklu dil; en yüksek skorlu sonuç döner.
 */

const Jimp = require('jimp');
const { STRATEGY_LIST } = require('./preprocessStrategies');
const { OptimizedOcr } = require('./optimizedOcr');

class MultiAttemptOcr {
  constructor(options = {}) {
    this.strategies = STRATEGY_LIST;
    this.ocr = new OptimizedOcr(options.languages);
  }

  /**
   * Görüntüyü tüm stratejilerle işleyip her biri için OCR çalıştırır; en iyi skorlu sonucu döndürür.
   * @param {Buffer} imageBuffer - JPEG/PNG buffer
   * @returns {Promise<{ best: object, attempts: array, allResults: array }>}
   */
  async readWithMultipleAttempts(imageBuffer) {
    const original = await Jimp.read(imageBuffer);
    const attempts = [];

    for (const strategy of this.strategies) {
      try {
        const processed = await strategy.fn(original);
        const buffer = await processed.getBufferAsync(Jimp.MIME_JPEG);
        const result = await this.ocr.readWithAllLanguages(buffer);
        const score = this.calculateScore(result.text);
        attempts.push({
          strategy: strategy.name,
          lang: result.lang,
          text: result.text,
          confidence: result.confidence,
          score,
        });
      } catch (err) {
        console.warn(`[MultiAttemptOcr] Strateji ${strategy.name} başarısız:`, err.message);
      }
    }

    const sorted = attempts.filter((a) => (a.text || '').length > 0).sort((a, b) => b.score - a.score);
    const best = sorted[0] || {
      strategy: 'none',
      lang: '',
      text: '',
      confidence: 0,
      score: 0,
    };

    return {
      best,
      attempts,
      allResults: attempts,
    };
  }

  /**
   * MRZ benzeri metin için skor: satır sayısı, P/I başlangıç, < sayısı, rakam yoğunluğu.
   */
  calculateScore(text) {
    if (!text || typeof text !== 'string') return 0;
    let score = 0;
    const lines = text
      .split(/\r\n|\r|\n/)
      .map((l) => l.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, ''))
      .filter((l) => l.length > 10);

    if (lines.length === 2 || lines.length === 3) score += 30;
    if (lines[0] && /^[PI]/.test(lines[0])) score += 20;
    const fillerCount = (text.match(/</g) || []).length;
    if (fillerCount > 10) score += 15;
    const digitCount = (text.match(/[0-9]/g) || []).length;
    if (digitCount > 15) score += 15;

    return score;
  }

  async terminate() {
    await this.ocr.terminate();
  }
}

module.exports = { MultiAttemptOcr };
