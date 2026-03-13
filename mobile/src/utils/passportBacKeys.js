/**
 * Pasaport BAC anahtarları — tüm dünya pasaportları için denenecek anahtar seti.
 * Ülke bazlı ön ekler ve yaygın formatlar.
 */

const DEFAULT_BIRTH = '1990-01-01';
const DEFAULT_EXPIRY = '2030-12-31';

/** Yaygın pasaport numarası formatları (ülke bağımsız). */
const COMMON_PASSPORT_NUMBERS = [
  '000000000', '111111111', '123456789', 'A12345678', 'P00000000', 'A00000000',
  '12345678', 'AB1234567', 'X12345678', '999999999', '000000001',
];

/** Ülke kodu → o ülkeye özel ek BAC anahtarları (ön ek / format). */
const COUNTRY_KEYS = {
  USA: [
    { documentNo: 'P00000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '123456789', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  GBR: [
    { documentNo: 'P00000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '123456789', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  DEU: [
    { documentNo: 'C00000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: 'P00000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  FRA: [
    { documentNo: '00AB12345', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  TUR: [
    { documentNo: 'U00000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '123456789', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  NLD: [
    { documentNo: 'AB1234567', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  ESP: [
    { documentNo: 'AAA000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
  ITA: [
    { documentNo: 'YA0000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  ],
};

/**
 * Pasaport için varsayılan BAC anahtarları listesi.
 * @returns {Array<{ documentNo: string; birthDate: string; expiryDate: string }>}
 */
export function getPassportBacKeys() {
  const list = [];
  for (const docNo of COMMON_PASSPORT_NUMBERS) {
    list.push({
      documentNo: docNo.padEnd(9, '<').slice(0, 9).replace(/</g, '0'),
      birthDate: DEFAULT_BIRTH,
      expiryDate: DEFAULT_EXPIRY,
    });
    list.push({
      documentNo: docNo,
      birthDate: DEFAULT_BIRTH,
      expiryDate: DEFAULT_EXPIRY,
    });
  }
  return list;
}

/**
 * Belirli ülke için ek BAC anahtarları.
 * @param {string} countryCode ISO 3 harf (örn. USA, GBR, TUR)
 * @returns {Array<{ documentNo: string; birthDate: string; expiryDate: string }>}
 */
export function getPassportBacKeysForCountry(countryCode) {
  if (!countryCode || typeof countryCode !== 'string') return [];
  const code = countryCode.toUpperCase().slice(0, 3);
  return COUNTRY_KEYS[code] || [];
}

/**
 * Önceden başarılı pasaport anahtarlarını al (bacCache'den). Async.
 * @param {string} [countryCode]
 * @returns {Promise<Array<{ documentNo: string; birthDate: string; expiryDate: string }>>}
 */
export async function getCachedPassportKeys(countryCode) {
  try {
    const { getSuccessfulKeys } = require('./bacCache');
    if (countryCode) return await getSuccessfulKeys(countryCode.toUpperCase().slice(0, 3));
    const all = [];
    const codes = Object.keys(COUNTRY_KEYS);
    for (const c of codes) {
      const k = await getSuccessfulKeys(c);
      all.push(...k);
    }
    all.push(...(await getSuccessfulKeys('XXX')));
    return all;
  } catch (_) {
    return [];
  }
}

export default {
  getPassportBacKeys,
  getPassportBacKeysForCountry,
  getCachedPassportKeys,
};
