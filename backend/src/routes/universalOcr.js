/**
 * KBS Prime - Optimized OCR API (Tesseract çoklu dil + 5 ön işleme stratejisi).
 * POST /optimized-ocr -> en iyi strateji + MRZ parse.
 */

const express = require('express');
const router = express.Router();
const { MultiAttemptOcr } = require('../lib/vision/multiAttemptOcr');
const { UniversalMrzParser } = require('../lib/mrz/universalMrzParser');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');

/**
 * POST /optimized-ocr
 * Body: { imageBase64: string }
 * Response: { success, bestStrategy, confidence, score, text, mrz, attempts }
 */
router.post(
  '/optimized-ocr',
  authenticateTesisOrSupabase,
  express.json({ limit: '20mb' }),
  async (req, res) => {
    let ocr;
    try {
      const { imageBase64 } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'imageBase64 gerekli',
        });
      }

      const imageBuffer = Buffer.from(imageBase64, 'base64');
      if (!imageBuffer.length) {
        return res.status(400).json({
          success: false,
          error: 'Geçersiz görüntü (base64 decode sonrası boş)',
        });
      }

      ocr = new MultiAttemptOcr();
      const result = await ocr.readWithMultipleAttempts(imageBuffer);
      await ocr.terminate();

      let mrzData = null;
      if (result.best.score > 50 && result.best.text) {
        mrzData = UniversalMrzParser.parse(result.best.text);
      }

      res.json({
        success: true,
        bestStrategy: result.best.strategy,
        confidence: result.best.confidence,
        score: result.best.score,
        text: result.best.text,
        mrz: mrzData,
        attempts: result.attempts.map((a) => ({
          strategy: a.strategy,
          confidence: a.confidence,
          score: a.score,
        })),
      });
    } catch (error) {
      if (ocr) {
        try {
          await ocr.terminate();
        } catch (_) {}
      }
      console.error('[universal-ocr] /optimized-ocr error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;
