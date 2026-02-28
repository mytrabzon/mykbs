/**
 * TR Kimlik (ön yüz) ROI + OCR + format validation.
 * Normalized size 1024x640; ROI boxes for TCKN, Ad, Soyad, Doğum Tarihi, Seri No.
 * For now we use full-image OCR (parseIdentityDocument) and validate TCKN; ROI can be added later with OpenCV.
 */

const Tesseract = require('tesseract.js');
const { validateTC } = require('./tr_common');

/**
 * Validate and normalize TR ID front OCR result.
 * @param {object} parsed - { ad, soyad, kimlikNo, dogumTarihi, ... } from parseIdentityDocument
 * @returns {{ fields: object, confidence: number }}
 */
function validateTrIdFields(parsed) {
  const fields = {
    ad: (parsed?.ad || '').trim(),
    soyad: (parsed?.soyad || '').trim(),
    tcKimlikNo: (parsed?.kimlikNo || '').replace(/\D/g, '').slice(0, 11) || null,
    dogumTarihi: parsed?.dogumTarihi || null,
    seriNo: parsed?.seriNo || null,
    uyruk: parsed?.uyruk || 'TÜRK',
  };
  let confidence = 50;
  if (fields.tcKimlikNo && fields.tcKimlikNo.length === 11 && validateTC(fields.tcKimlikNo)) confidence += 35;
  if (fields.ad && fields.soyad) confidence += 10;
  if (fields.dogumTarihi) confidence += 5;
  return { fields, confidence: Math.min(100, confidence) };
}

module.exports = {
  validateTrIdFields,
};
