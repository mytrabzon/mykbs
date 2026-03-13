/**
 * KBS Prime - Tesseract çoklu dil optimizasyonu.
 * Her dil için ayrı worker; paralel OCR ile en yüksek güven skorlu sonuç seçilir.
 */

const Tesseract = require('tesseract.js');

const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
/** Sadece cloneable değerler (worker.postMessage için; fonksiyon gönderilemez). */
const TESSERACT_PARAMS = {
  tessedit_pageseg_mode: 6,
  tessedit_char_whitelist: MRZ_WHITELIST,
};

/** Varsayılan diller: pasaport (eng), T.C. kimlik (tur), Ortadoğu (ara), Afrika/Fransa (fra), AV (deu). */
const DEFAULT_LANGUAGES = ['eng', 'tur', 'ara', 'fra', 'deu'];

class OptimizedOcr {
  /**
   * @param {string[]} [languages] - Tesseract dil kodları (varsayılan: eng, tur, ara, fra, deu)
   */
  constructor(languages = DEFAULT_LANGUAGES) {
    this.languages = Array.isArray(languages) && languages.length ? languages : DEFAULT_LANGUAGES;
    this.workers = [];
  }

  async initWorkers() {
    if (this.workers.length > 0) return;
    for (const lang of this.languages) {
      try {
        const worker = await Tesseract.createWorker(lang);
        await worker.setParameters(TESSERACT_PARAMS);
        this.workers.push({ lang, worker });
      } catch (err) {
        console.warn(`[OptimizedOcr] Dil yüklenemedi: ${lang}`, err.message);
      }
    }
  }

  /**
   * Tüm dillerde paralel OCR; en yüksek confidence'a sahip sonucu döndürür.
   * @param {Buffer} imageBuffer - JPEG/PNG buffer
   * @returns {Promise<{ lang: string, text: string, confidence: number }>}
   */
  async readWithAllLanguages(imageBuffer) {
    if (this.workers.length === 0) await this.initWorkers();
    if (this.workers.length === 0) {
      const fallback = await Tesseract.createWorker('eng');
      await fallback.setParameters(TESSERACT_PARAMS);
      const { data } = await fallback.recognize(imageBuffer);
      await fallback.terminate();
      return { lang: 'eng', text: (data.text || '').trim(), confidence: data.confidence || 0 };
    }

    const results = await Promise.all(
      this.workers.map(async ({ lang, worker }) => {
        try {
          const { data } = await worker.recognize(imageBuffer);
          return {
            lang,
            text: (data.text || '').trim(),
            confidence: typeof data.confidence === 'number' ? data.confidence : 0,
          };
        } catch (err) {
          console.warn(`[OptimizedOcr] OCR hatası (${lang}):`, err.message);
          return { lang, text: '', confidence: 0 };
        }
      })
    );

    const sorted = results.filter((r) => r.text.length > 0).sort((a, b) => b.confidence - a.confidence);
    return sorted.length ? sorted[0] : results[0] || { lang: 'eng', text: '', confidence: 0 };
  }

  async terminate() {
    for (const { worker } of this.workers) {
      try {
        await worker.terminate();
      } catch (_) {}
    }
    this.workers = [];
  }
}

module.exports = {
  OptimizedOcr,
  DEFAULT_LANGUAGES,
  TESSERACT_PARAMS,
  MRZ_WHITELIST,
};
