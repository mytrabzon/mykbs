/**
 * Scan event logging with correlationId. No PII in logs (use redact before logging).
 */

const { maskMrz, maskTckn, maskDocumentNumber } = require('../security/redact');

const LOG_PREFIX = '[scan]';

/**
 * Log a scan event (backend side). PII must already be redacted in payload.
 * @param {string} correlationId - Request correlation id
 * @param {string} event - Event name: preprocess_done, mrz_crop_done, ocr_done, parse_done, error
 * @param {object} meta - Optional: docType, durationMs, errorCode, etc. Do not put raw MRZ or full doc numbers.
 */
function logScanEvent(correlationId, event, meta = {}) {
  const payload = { correlationId, event, ...meta };
  console.log(LOG_PREFIX, JSON.stringify(payload));
}

/**
 * Safe meta for MRZ parse result: only masked values and checks.
 */
function safeMrzMeta(mrzRaw, fields, checks) {
  const masked = mrzRaw ? maskMrz(mrzRaw) : undefined;
  return {
    mrzRawMasked: masked,
    confidenceHint: checks?.ok ? 'high' : 'low',
    passportNoCheck: checks?.passportNoCheck,
    birthCheck: checks?.birthCheck,
    expiryCheck: checks?.expiryCheck,
    compositeCheck: checks?.compositeCheck,
  };
}

/**
 * Safe meta for doc parse result (TR ID / DL): masked identifiers only.
 */
function safeDocMeta(fields, docType) {
  const meta = { docType };
  if (fields?.tcKimlikNo) meta.tcKimlikNoMasked = maskTckn(fields.tcKimlikNo);
  if (fields?.documentNumber) meta.documentNumberMasked = maskDocumentNumber(fields.documentNumber);
  return meta;
}

module.exports = {
  logScanEvent,
  safeMrzMeta,
  safeDocMeta,
};
