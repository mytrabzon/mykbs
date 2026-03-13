/**
 * KBS Prime - Evrensel MRZ API (Sıfırdan, özgün)
 * POST /read   -> tek görüntü, tek/çoklu deneme, parse
 * POST /read-multiple -> birden fazla MRZ (yan yana belgeler)
 */

const express = require('express');
const router = express.Router();
const { UniversalMrzParser } = require('../lib/mrz/universalMrzParser');
const { UniversalPreprocessor } = require('../lib/vision/universalPreprocess');
const { UniversalOcr } = require('../lib/vision/universalOcr');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');

/**
 * POST /read
 * Body: { imageBase64: string, options?: { isPhotocopy?: boolean, isScreen?: boolean } }
 * Response: { success, confidence, mrz, parsed, format }
 */
router.post(
  '/read',
  authenticateTesisOrSupabase,
  express.json({ limit: '20mb' }),
  async (req, res) => {
    try {
      const { imageBase64, options = {} } = req.body || {};
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

      const preprocessor = new UniversalPreprocessor();
      const ocr = new UniversalOcr();

      await ocr.initialize();

      const variants = [];
      variants.push(await preprocessor.preprocessForMrz(imageBuffer, options));
      for (let i = 1; i <= 2; i++) {
        variants.push(await preprocessor.preprocessVariant(imageBuffer, i));
      }

      const { text, confidence } = await ocr.readWithMultipleAttempts(variants, 3);
      await ocr.terminate();

      if (!text || text.length < 30) {
        return res.json({
          success: false,
          confidence: 0,
          mrz: '',
          parsed: null,
          format: 'UNKNOWN',
          error: 'MRZ okunamadı',
        });
      }

      const parsed = UniversalMrzParser.parse(text);
      const format = parsed.format || 'UNKNOWN';

      res.json({
        success: parsed.format !== 'UNKNOWN',
        confidence,
        mrz: text,
        parsed,
        format,
      });
    } catch (error) {
      console.error('[universal-mrz] /read error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /read-multiple
 * Body: { imageBase64: string }
 * Görüntüde birden fazla MRZ bölgesi aranır (yan yana pasaport vb.).
 */
router.post(
  '/read-multiple',
  authenticateTesisOrSupabase,
  express.json({ limit: '20mb' }),
  async (req, res) => {
    try {
      const { imageBase64 } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({
          success: false,
          results: [],
          error: 'imageBase64 gerekli',
        });
      }

      const imageBuffer = Buffer.from(imageBase64, 'base64');
      if (!imageBuffer.length) {
        return res.status(400).json({
          success: false,
          results: [],
          error: 'Geçersiz görüntü',
        });
      }

      const Jimp = require('jimp');
      const preprocessor = new UniversalPreprocessor();
      const ocr = new UniversalOcr();
      await ocr.initialize();

      const image = await Jimp.read(imageBuffer);
      const w = image.bitmap.width;
      const h = image.bitmap.height;
      const sliceHeight = Math.floor(h / 3);
      const results = [];

      for (let i = 0; i < 3; i++) {
        const yStart = i * sliceHeight;
        const slice = image.clone().crop(0, yStart, w, sliceHeight);
        const buf = await slice.getBufferAsync(Jimp.MIME_JPEG);
        const variants = [];
        variants.push(await preprocessor.preprocessForMrz(buf, {}));
        variants.push(await preprocessor.preprocessVariant(buf, 1));
        const { text, confidence } = await ocr.readWithMultipleAttempts(variants, 2);
        if (text && text.length > 50) {
          const parsed = UniversalMrzParser.parse(text);
          results.push({
            position: i,
            mrz: text,
            confidence,
            parsed,
            format: parsed.format || 'UNKNOWN',
          });
        }
      }

      await ocr.terminate();

      res.json({
        success: results.length > 0,
        results,
      });
    } catch (error) {
      console.error('[universal-mrz] /read-multiple error:', error.message);
      res.status(500).json({
        success: false,
        results: [],
        error: error.message,
      });
    }
  }
);

module.exports = router;
