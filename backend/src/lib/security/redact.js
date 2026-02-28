/**
 * PII redaction for scan logs and responses.
 * Rule: never log full MRZ or full identity numbers; use mask like 12******89.
 */

/**
 * Mask a string: show first 2 and last 2 chars, middle as asterisks.
 * @param {string} value - Raw value (MRZ line, doc number, TCKN, etc.)
 * @param {number} minVisible - Min chars to show at start/end (default 2)
 * @returns {string} Masked value, e.g. "12******89"
 */
function maskMiddle(value, minVisible = 2) {
  if (value == null || typeof value !== 'string') return '';
  const s = value.trim();
  if (s.length <= minVisible * 2) return '****';
  const start = s.slice(0, minVisible);
  const end = s.slice(-minVisible);
  return start + '******' + end;
}

/**
 * Mask MRZ raw (multiple lines): mask each line with first/last 2 chars.
 * @param {string} mrzRaw - Full MRZ string (e.g. 2 or 3 lines)
 * @returns {string} Masked MRZ for logging
 */
function maskMrz(mrzRaw) {
  if (mrzRaw == null || typeof mrzRaw !== 'string') return '';
  return mrzRaw
    .split(/\r\n|\r|\n/)
    .map((line) => maskMiddle(line, 2))
    .join('\n');
}

/**
 * Mask Turkish ID number (11 digits): show first 2 and last 2.
 * @param {string} tckn - 11-digit TCKN
 * @returns {string} e.g. "12******89"
 */
function maskTckn(tckn) {
  if (tckn == null || typeof tckn !== 'string') return '';
  const digits = tckn.replace(/\D/g, '');
  if (digits.length < 11) return '****';
  return maskMiddle(digits, 2);
}

/**
 * Mask passport/document number (alphanumeric).
 * @param {string} docNo - Document number
 * @returns {string} Masked
 */
function maskDocumentNumber(docNo) {
  if (docNo == null || typeof docNo !== 'string') return '';
  return maskMiddle(docNo.trim(), 2);
}

module.exports = {
  maskMiddle,
  maskMrz,
  maskTckn,
  maskDocumentNumber,
};
