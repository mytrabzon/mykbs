/**
 * POST /scan/doc/parse
 * Body: imageBase64, docType ("tr_id_front"|"tr_dl_front"|"unknown_front"), correlationId
 * Response: ok, confidence, fields (docType'a göre), errorCode?
 */

const express = require('express');
const router = express.Router();
const { authenticateTesisOrSupabase } = require('../../middleware/authTesisOrSupabase');
const { preprocessFromBase64 } = require('../../lib/vision/preprocess');
const { runDocumentOcr } = require('../../lib/vision/documentOcr');
const { validateTrIdFields } = require('../../lib/vision/tr_id');
const { validateTrDlFields } = require('../../lib/vision/tr_dl');
const { logScanEvent, safeDocMeta } = require('../../lib/log/scanLog');
const fs = require('fs');
const path = require('path');

router.post('/doc/parse', authenticateTesisOrSupabase, express.json({ limit: '8mb' }), async (req, res) => {
  const { imageBase64, docType, correlationId } = req.body || {};
  const corr = correlationId || req.requestId || 'no-correlation';
  let filePath = null;

  try {
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      console.warn('[scan doc/parse] Storage\'a yazılmadı: imageBase64 yok veya string değil.');
      return res.status(400).json({ ok: false, errorCode: 'missing_image', message: 'imageBase64 gerekli' });
    }

    const uploadsDir = path.join(__dirname, '../../../uploads/scan');
    const { filePath: fp } = await preprocessFromBase64(imageBase64, uploadsDir);
    filePath = fp;

    logScanEvent(corr, 'preprocess_done', { docType });

    const parsed = await runDocumentOcr(filePath);
    logScanEvent(corr, 'ocr_done', { docType });

    const docTypeNorm = (docType || 'unknown_front').toLowerCase();

    if (docTypeNorm === 'tr_id_front') {
      const { fields, confidence } = validateTrIdFields(parsed);
      logScanEvent(corr, 'parse_done', safeDocMeta({ ...fields, tcKimlikNo: fields.tcKimlikNo }, docTypeNorm));
      return res.json({ ok: confidence >= 50, confidence, fields });
    }

    if (docTypeNorm === 'tr_dl_front') {
      const { fields, confidence } = validateTrDlFields(parsed);
      logScanEvent(corr, 'parse_done', safeDocMeta(fields, docTypeNorm));
      return res.json({ ok: confidence >= 50, confidence, fields });
    }

    // unknown_front: return generic parsed fields
    const fields = {
      ad: parsed.ad,
      soyad: parsed.soyad,
      tcKimlikNo: parsed.kimlikNo,
      pasaportNo: parsed.pasaportNo,
      dogumTarihi: parsed.dogumTarihi,
      uyruk: parsed.uyruk,
    };
    const confidence = (fields.tcKimlikNo ? 70 : 0) + (fields.ad && fields.soyad ? 20 : 0) + (fields.dogumTarihi ? 10 : 0);
    logScanEvent(corr, 'parse_done', safeDocMeta(fields, 'unknown_front'));
    res.json({ ok: confidence >= 50, confidence: Math.min(100, confidence), fields });
  } catch (error) {
    console.error('[scan] doc/parse error:', error.message, '- Storage\'a yazılamadı veya OCR hatası.');
    logScanEvent(corr, 'error', { errorCode: 'server_error', message: error.message });
    res.status(500).json({
      ok: false,
      confidence: 0,
      fields: {},
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
