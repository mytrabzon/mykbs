/**
 * BAC (Basic Access Control) anahtarı MRZ'den türetilir.
 * Pasaport çipini okumak için NFC okuyucu bu anahtarı kullanır.
 * Gerçek implementasyon: MRZ'deki doc number, doğum tarihi, son geçerlilik
 * alanlarından SHA-1 ile key seed üretilir (ICAO 9303).
 *
 * Bu modül şu an sadece "NFC için MRZ gerekli" bilgisini ve
 * ileride BAC hesaplaması için gerekli alanları döndürür.
 */

/**
 * MRZ payload'ından BAC için kullanılan alanları çıkarır.
 * @param {{ passportNumber?: string; birthDate?: string; expiryDate?: string }} payload
 * @returns {{ documentNumber: string; birthDate: string; expiryDate: string } | null}
 */
export function getBacFieldsFromMrz(payload) {
  if (!payload) return null;
  const doc = (payload.passportNumber || '').trim().toUpperCase().replace(/</g, '');
  const birth = formatDateForBac(payload.birthDate);
  const expiry = formatDateForBac(payload.expiryDate);
  if (!doc || !birth || !expiry) return null;
  return { documentNumber: doc, birthDate: birth, expiryDate: expiry };
}

function formatDateForBac(isoDate) {
  if (!isoDate) return '';
  const d = isoDate.replace(/-/g, '');
  if (d.length === 8) return d.slice(2); // YYMMDD
  return '';
}

/**
 * BAC key üretimi (native tarafta veya crypto kütüphanesi ile yapılabilir).
 * Şu an placeholder: "MRZ okunduktan sonra NFC aktif olur" mesajı için kullanılır.
 */
export function hasBacFields(payload) {
  return !!getBacFieldsFromMrz(payload);
}
