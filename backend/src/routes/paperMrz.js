/**
 * KBS Prime - Kağıt/fotokopi MRZ API (HMS benzeri çoklu strateji).
 * POST /paper-mrz -> imageBase64, döner: text, parsed, confidence, strategy, resolution, validation, score.
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { PaperMrzProcessor } = require('../lib/vision/paperMrzProcessor');
const { UniversalMrzParser } = require('../lib/mrz/universalMrzParser');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat
const resultCache = new Map();

function getImageHash(buffer) {
  const head = buffer.slice(0, 1024);
  return crypto.createHash('sha256').update(head).update(String(buffer.length)).digest('hex');
}

function getCachedResult(imageHash) {
  const entry = resultCache.get(imageHash);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.result;
  if (entry) resultCache.delete(imageHash);
  return null;
}

function setCachedResult(imageHash, result) {
  resultCache.set(imageHash, { result, timestamp: Date.now() });
  if (resultCache.size > 500) {
    const oldest = [...resultCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) resultCache.delete(oldest[0]);
  }
}

router.post(
  '/paper-mrz',
  authenticateTesisOrSupabase,
  express.json({ limit: '20mb' }),
  async (req, res) => {
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

      const imageHash = getImageHash(imageBuffer);
      const cached = getCachedResult(imageHash);
      if (cached) {
        return res.json(cached);
      }

      const processor = new PaperMrzProcessor();
      const result = await processor.processPaperMrz(imageBuffer);

      let mrzData = null;
      if (result.text) {
        try {
          mrzData = UniversalMrzParser.parse(result.text);
        } catch (_) {}
      }

      const payload = {
        success: !!result.text,
        text: result.text,
        parsed: mrzData,
        confidence: result.confidence,
        strategy: result.strategy,
        resolution: result.resolution,
        validation: result.validation,
        score: result.score,
      };
      setCachedResult(imageHash, payload);
      res.json(payload);
    } catch (error) {
      console.error('[paper-mrz] error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;
