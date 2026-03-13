/**
 * NFC / ePassport okuyucudan gelen teknik hata mesajlarını kullanıcı dostu Türkçe metne çevirir.
 * Özellikle "Security status not satisfied" (çip 0x6982) ve benzeri APDU hataları.
 */

const NFC_ERROR_MAP = [
  {
    // "Security status not satisfied" (0x6982) — İngilizce + yazım varyantları (SECURYT, STATÜS, SATİSFİED)
    pattern: /security\s*status\s*not\s*sat[iıİ]sfied|security\s*not\s*sat[iıİ]sfied|securyt\s*not\s*stat|status\s*not\s*sat[iıİ]sfied|not\s*status\s*sat[iıİ]sfied|6982/i,
    message: 'Çip güvenlik doğrulaması sağlanamadı. Önce kartın arkasındaki MRZ alanını okutun, sonra kartı tekrar yaklaştırın.',
  },
  {
    pattern: /conditions\s*of\s*use\s*not\s*satisfied|6985/i,
    message: 'Bu işlem için kart izin vermiyor. MRZ okutup tekrar deneyin.',
  },
  {
    pattern: /file\s*not\s*found|6a82/i,
    message: 'Belge verisi bulunamadı. Kartı sabit tutup tekrar deneyin.',
  },
  {
    pattern: /tag\s*connection\s*lost|tag\s*lost|connection\s*lost/i,
    message: 'Bağlantı koptu. Kartı telefonun arkasına sabit tutup tekrar deneyin.',
  },
  {
    pattern: /session\s*invalidated|invalidated/i,
    message: 'Oturum sonlandı. Kartı tekrar yaklaştırın.',
  },
  {
    pattern: /cancelled|cancel|user\s*cancel/i,
    message: 'Okuma iptal edildi.',
  },
  {
    pattern: /wrong\s*length|incorrect\s*length/i,
    message: 'Kart yanıtı beklenenden farklı. Kartı sabit tutup tekrar deneyin.',
  },
  {
    pattern: /no\s*response|timeout/i,
    message: 'Kart yanıt vermedi. Kartı tam yaslayıp sabit tutun.',
  },
];

/**
 * Ham hata mesajını kullanıcıya gösterilecek Türkçe metne çevirir.
 * @param {string} [rawMessage] - Native/JS'den gelen hata metni
 * @returns {string} Türkçe açıklama
 */
export function toUserFriendlyNfcError(rawMessage) {
  if (!rawMessage || typeof rawMessage !== 'string') return 'NFC okunamadı. MRZ okutup tekrar deneyin.';
  const msg = rawMessage.trim();
  for (const { pattern, message } of NFC_ERROR_MAP) {
    if (pattern.test(msg)) return message;
  }
  return msg;
}

export default { toUserFriendlyNfcError };
