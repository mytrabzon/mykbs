/**
 * MRZ benzersizlik / A4-fotokopi kontrolü.
 * Aynı belge kısa sürede tekrar okunursa (fotokopi sayfaları) duplicate sayar.
 */

const QUICK_DUPLICATE_MS = 10000;  // 10 saniye içinde aynı belge = muhtemelen fotokopi
const SAME_DOC_WARNING_MS = 3600000; // 1 saat içinde aynı belge = uyarı ile kabul

/**
 * Yeni okunan MRZ'ın önceki okumayla aynı belge olup olmadığını ve kabul edilip edilmeyeceğini değerlendirir.
 * @param {object} newMrz - Yeni parse edilmiş MRZ (documentNumber/passportNumber, birthDate, expiryDate, scannedAt)
 * @param {object|null} lastMrz - Son gösterilen MRZ
 * @returns {{ isValid: boolean, reason?: string, message?: string, warning?: string }}
 */
export function validateMrzUniqueness(newMrz, lastMrz) {
  if (!lastMrz) return { isValid: true };

  const docNum = (newMrz.documentNumber ?? newMrz.passportNumber ?? newMrz.kimlikNo ?? '').toString().trim();
  const lastDocNum = (lastMrz.documentNumber ?? lastMrz.passportNumber ?? lastMrz.kimlikNo ?? '').toString().trim();
  const birth = (newMrz.birthDate ?? '').toString().trim();
  const lastBirth = (lastMrz.birthDate ?? '').toString().trim();
  const expiry = (newMrz.expiryDate ?? '').toString().trim();
  const lastExpiry = (lastMrz.expiryDate ?? '').toString().trim();

  const isSameDocument =
    docNum && docNum === lastDocNum &&
    birth === lastBirth &&
    expiry === lastExpiry;

  if (!isSameDocument) return { isValid: true };

  const scannedAt = newMrz.scannedAt ? new Date(newMrz.scannedAt).getTime() : Date.now();
  const lastScannedAt = lastMrz.scannedAt ? new Date(lastMrz.scannedAt).getTime() : 0;
  const timeDiff = lastScannedAt ? scannedAt - lastScannedAt : 0;

  if (timeDiff >= 0 && timeDiff < QUICK_DUPLICATE_MS) {
    return {
      isValid: false,
      reason: 'DUPLICATE_QUICK',
      message: 'Bu belge çok kısa sürede tekrar okundu',
    };
  }

  if (timeDiff >= 0 && timeDiff < SAME_DOC_WARNING_MS) {
    return {
      isValid: true,
      warning: 'Bu belge daha önce okunmuştu',
    };
  }

  return { isValid: true };
}
