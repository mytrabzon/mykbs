// KVKK uyumluluğu için veri maskeleme fonksiyonları

/**
 * Kimlik numarasını maskeler (örn: 12345678901 -> 123*****901)
 */
function maskKimlikNo(kimlikNo) {
  if (!kimlikNo || kimlikNo.length < 6) return kimlikNo;
  const first = kimlikNo.substring(0, 3);
  const last = kimlikNo.substring(kimlikNo.length - 3);
  return `${first}${'*'.repeat(kimlikNo.length - 6)}${last}`;
}

/**
 * Pasaport numarasını maskeler
 */
function maskPasaportNo(pasaportNo) {
  if (!pasaportNo || pasaportNo.length < 4) return pasaportNo;
  const first = pasaportNo.substring(0, 2);
  const last = pasaportNo.substring(pasaportNo.length - 2);
  return `${first}${'*'.repeat(pasaportNo.length - 4)}${last}`;
}

/**
 * Ad soyadı maskeler (örn: Ahmet Yılmaz -> A*** Y****)
 */
function maskAdSoyad(ad, soyad) {
  const maskedAd = ad ? `${ad[0]}${'*'.repeat(Math.max(0, ad.length - 1))}` : '';
  const maskedSoyad = soyad ? `${soyad[0]}${'*'.repeat(Math.max(0, soyad.length - 1))}` : '';
  return { ad: maskedAd, soyad: maskedSoyad };
}

/**
 * Telefon numarasını maskeler
 */
function maskTelefon(telefon) {
  if (!telefon || telefon.length < 6) return telefon;
  const first = telefon.substring(0, 3);
  const last = telefon.substring(telefon.length - 2);
  return `${first}${'*'.repeat(telefon.length - 5)}${last}`;
}

/**
 * E-posta adresini maskeler
 */
function maskEmail(email) {
  if (!email) return email;
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const maskedLocal = local.length > 2 
    ? `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`
    : local;
  return `${maskedLocal}@${domain}`;
}

module.exports = {
  maskKimlikNo,
  maskPasaportNo,
  maskAdSoyad,
  maskTelefon,
  maskEmail
};

