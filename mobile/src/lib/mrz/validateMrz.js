/**
 * MRZ payload doğrulama: süre, format, zorunlu alanlar.
 * Tarih normalize ve check digit parseMrz içinde yapılıyor.
 */

/**
 * @param {import('./mrzTypes').MrzPayload} payload
 * @returns {{ valid: boolean; reason?: string }}
 */
export function validateMrz(payload) {
  if (!payload) return { valid: false, reason: 'no_payload' };
  if (!payload.checks?.ok) return { valid: false, reason: payload.checks?.reason || 'check_digit_fail' };

  if (!payload.passportNumber?.trim()) return { valid: false, reason: 'missing_document_number' };
  if (!payload.birthDate) return { valid: false, reason: 'missing_birth_date' };
  if (!payload.expiryDate) return { valid: false, reason: 'missing_expiry_date' };

  const birth = new Date(payload.birthDate);
  const expiry = new Date(payload.expiryDate);
  const now = new Date();

  if (isNaN(birth.getTime())) return { valid: false, reason: 'invalid_birth_date' };
  if (isNaN(expiry.getTime())) return { valid: false, reason: 'invalid_expiry_date' };
  if (birth > now) return { valid: false, reason: 'birth_date_future' };
  if (expiry < now) return { valid: false, reason: 'document_expired' };

  if (payload.issuingCountry?.length !== 3) return { valid: false, reason: 'invalid_issuing_country' };

  return { valid: true };
}

/**
 * Server'a gönderilecek minimal alanlar (roadmap).
 * @param {import('./mrzTypes').MrzPayload} payload
 */
export function toMinimalPayload(payload) {
  if (!payload) return null;
  return {
    passportNumber: payload.passportNumber?.trim() || '',
    birthDate: payload.birthDate || '',
    expiryDate: payload.expiryDate || '',
    issuingCountry: payload.issuingCountry || '',
    docType: payload.docType || 'OTHER',
  };
}
