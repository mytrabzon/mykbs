/**
 * TR Ehliyet (ön yüz) ROI + OCR + field mapping.
 * For now we use full-image OCR and return ad, soyad, dogumTarihi, belgeNo, gecerlilik, sinif.
 * ROI templates can be added later.
 */

/**
 * Validate and normalize TR DL front OCR result.
 * @param {object} parsed - From full-page OCR (e.g. parseIdentityDocument or DL-specific parser)
 * @returns {{ fields: object, confidence: number }}
 */
function validateTrDlFields(parsed) {
  const fields = {
    ad: (parsed?.ad || '').trim(),
    soyad: (parsed?.soyad || '').trim(),
    dogumTarihi: parsed?.dogumTarihi || null,
    belgeNo: (parsed?.belgeNo || parsed?.kimlikNo || '').trim() || null,
    gecerlilik: parsed?.gecerlilik || null,
    sinif: (parsed?.sinif || '').trim() || null,
  };
  let confidence = 50;
  if (fields.ad && fields.soyad) confidence += 25;
  if (fields.dogumTarihi) confidence += 15;
  if (fields.belgeNo) confidence += 10;
  return { fields, confidence: Math.min(100, confidence) };
}

module.exports = {
  validateTrDlFields,
};
