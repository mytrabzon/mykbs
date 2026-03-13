/**
 * POST /scan/mrz/parse
 * Body: imageBase64, docTypeHint ("passport"|"id"|"unknown"), correlationId
 * Response: ok, confidence, mrzRawMasked?, fields, checks, errorCode?
 */

const express = require('express');
const router = express.Router();
const { authenticateTesisOrSupabase } = require('../../middleware/authTesisOrSupabase');
const { preprocessFromBase64 } = require('../../lib/vision/preprocess');
const { runMrzPipeline } = require('../../lib/vision/mrz');
const fs = require('fs');

router.post('/mrz/parse', authenticateTesisOrSupabase, express.json({ limit: '8mb' }), async (req, res) => {
  const { imageBase64, docTypeHint, correlationId, paperMode } = req.body || {};
  const corr = correlationId || req.requestId || 'no-correlation';
  const usePaperMode = !!paperMode;
  let filePath = null;

  try {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      console.warn('[scan mrz/parse] Storage\'a yazılmadı: imageBase64 yok veya string değil.');
      return res.status(400).json({ ok: false, errorCode: 'missing_image', message: 'imageBase64 gerekli' });
    }

    const uploadsDir = require('path').join(__dirname, '../../../uploads/scan');
    const { filePath: fp } = await preprocessFromBase64(imageBase64, uploadsDir, { paperMode: usePaperMode });
    filePath = fp;

    const docHint = (docTypeHint || '').toLowerCase();
    const result = await runMrzPipeline(filePath, corr, { paperMode: usePaperMode, docTypeHint: docHint === 'id' ? 'id' : undefined });

    const fields = { ...(result.fields || {}) };
    // Türkiye Cumhuriyeti kimlik kartı: TUR + 11 hane (personalNumber veya documentNumber) → kimlikNo
    const issuingCountry = (fields.issuingCountry || '').trim().toUpperCase();
    const personalNumber = String(fields.personalNumber || '').replace(/\D/g, '');
    const documentNumber = String(fields.documentNumber || '').replace(/\D/g, '');
    if (issuingCountry === 'TUR' && /^\d{11}$/.test(personalNumber)) {
      fields.kimlikNo = personalNumber;
      fields.pasaportNo = null;
    } else if (issuingCountry === 'TUR' && /^\d{11}$/.test(documentNumber)) {
      fields.kimlikNo = documentNumber;
      fields.pasaportNo = null;
    } else if (issuingCountry === 'TUR' && (fields.documentNumber || fields.personalNumber)) {
      fields.pasaportNo = fields.documentNumber || fields.personalNumber;
    }

    const response = {
      ok: result.ok,
      confidence: result.confidence,
      fields,
      checks: result.checks || {},
    };
    if (result.mrzRawMasked != null) response.mrzRawMasked = result.mrzRawMasked;
    if (result.errorCode) response.errorCode = result.errorCode;

    res.json(response);
  } catch (error) {
    console.error('[scan] mrz/parse error:', error.message, '- Storage\'a yazılamadı veya pipeline hatası.');
    res.status(500).json({
      ok: false,
      confidence: 0,
      fields: {},
      checks: {},
      errorCode: 'server_error',
      message: error.message,
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
});

module.exports = router;
