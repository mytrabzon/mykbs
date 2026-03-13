/**
 * T.C. Kimlik Kartı BAC anahtarları — MRZ'sız NFC okuma için denenecek anahtar seti.
 * ICAO 9303: documentNumber (9) + birthDate (YYMMDD) + expiryDate (YYMMDD).
 * Native NfcPassportReader yyyy-MM-dd bekler.
 */

/** YYYY-MM-DD formatına çevir (native BAC key). */
function toYYYYMMDD(yymmdd) {
  if (!yymmdd || yymmdd.length < 6) return null;
  const yy = yymmdd.slice(0, 2);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const yyyy = parseInt(yy, 10) < 50 ? `20${yy}` : `19${yy}`;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Doğum tarihleri üret (18–70 yaş ağırlıklı): YYMMDD → { birthDate: yyyy-MM-dd }
 * @param {number} startYear
 * @param {number} endYear
 */
export function generateBirthDates(startYear, endYear) {
  const dates = [];
  const days = [1, 15, 30];
  for (let year = startYear; year <= endYear; year++) {
    const yy = String(year).slice(-2);
    for (let month = 1; month <= 12; month++) {
      const mm = String(month).padStart(2, '0');
      for (const day of days) {
        const dd = String(day).padStart(2, '0');
        const yymmdd = `${yy}${mm}${dd}`;
        const iso = toYYYYMMDD(yymmdd);
        if (iso) dates.push({ birthDate: iso });
      }
    }
  }
  return dates;
}

/**
 * Son kullanma tarihleri (belge geçerlilik): 2017–2035 arası yıl sonu / yıl ortası.
 */
export function generateExpiryDates(startYear, endYear) {
  const dates = [];
  for (let y = startYear; y <= endYear; y++) {
    const yy = String(y).slice(-2);
    dates.push({ expiryDate: toYYYYMMDD(`${yy}1231`) });
    dates.push({ expiryDate: toYYYYMMDD(`${yy}0630`) });
  }
  return dates.filter((d) => d.expiryDate);
}

/**
 * TC kimlik belge numarası benzeri 9 karakter (rakam + harf karışık).
 * İlk birkaç hane sık kullanılan kalıplar.
 */
export function generateTurkishIdDocumentNumbers() {
  const keys = [];
  const prefixes = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B'];
  for (const p of prefixes) {
    for (let i = 0; i < 20; i++) {
      const rest = String(100000000 + Math.floor(Math.random() * 899999999)).slice(0, 8);
      keys.push({ documentNo: (p + rest).replace(/\d{9}$/, (m) => m.slice(0, 9)) });
    }
  }
  const fixed = [
    '000000000', '111111111', '123456789', '000000001', '999999999',
    '12345678901', '11111111111', '00000000000', '98765432101', '55555555555',
    'AAAAAAAAAAA', 'IDTURK12345', 'A1B2C3D4E', '123456789012',
  ];
  const withDocNo = fixed.map((d) => ({ documentNo: String(d).slice(0, 9) }));
  return [...new Map([...withDocNo, ...keys].map((k) => [k.documentNo, k])).values()];
}

const DEFAULT_BIRTH = '1990-01-01';
const DEFAULT_EXPIRY = '2030-12-31';

/**
 * Tam BAC anahtarı objesi: { documentNo, birthDate, expiryDate }.
 * Boş/test + sık doğum + sık belge no + sık son kullanma kombinasyonları.
 */
function buildFullTurkishKeys() {
  const list = [];

  list.push(
    { documentNo: '000000000', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '111111111', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '000000000', birthDate: '1985-05-15', expiryDate: DEFAULT_EXPIRY },
    { documentNo: '000000000', birthDate: '2000-12-31', expiryDate: '2025-06-01' },
    { documentNo: '123456789', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '12345678901', birthDate: '1985-05-15', expiryDate: '2025-06-01' },
    { documentNo: '98765432101', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: '55555555555', birthDate: '2000-12-31', expiryDate: '2028-12-31' },
    { documentNo: 'AAAAAAAAAAA', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
    { documentNo: 'IDTURK12345', birthDate: DEFAULT_BIRTH, expiryDate: DEFAULT_EXPIRY },
  );

  const birthOnly = generateBirthDates(1970, 2005);
  const expiryOnly = generateExpiryDates(2020, 2035);
  const docNumbers = generateTurkishIdDocumentNumbers();

  for (const b of birthOnly.slice(0, 120)) {
    list.push({
      documentNo: '000000000',
      birthDate: b.birthDate,
      expiryDate: DEFAULT_EXPIRY,
    });
  }
  for (const e of expiryOnly.slice(0, 30)) {
    list.push({
      documentNo: '000000000',
      birthDate: DEFAULT_BIRTH,
      expiryDate: e.expiryDate,
    });
  }
  for (const d of docNumbers.slice(0, 80)) {
    list.push({
      documentNo: d.documentNo,
      birthDate: DEFAULT_BIRTH,
      expiryDate: DEFAULT_EXPIRY,
    });
  }

  return list;
}

let cachedFullKeys = null;

/**
 * T.C. kimlik kartı için denenecek tüm BAC anahtarları (cache'den gelenler hariç).
 * @returns {Array<{ documentNo: string; birthDate: string; expiryDate: string }>}
 */
export function getTurkishIdBacKeys() {
  if (!cachedFullKeys) cachedFullKeys = buildFullTurkishKeys();
  return [...cachedFullKeys];
}

/**
 * Önceden başarılı olan anahtarları al (bacCache'den). Async.
 * @returns {Promise<Array<{ documentNo: string; birthDate: string; expiryDate: string }>>}
 */
export async function getCachedTurkishKeys() {
  try {
    const { getSuccessfulKeys } = require('./bacCache');
    return await getSuccessfulKeys('TUR');
  } catch (_) {
    return [];
  }
}

export default {
  generateBirthDates,
  generateExpiryDates,
  generateTurkishIdDocumentNumbers,
  getTurkishIdBacKeys,
  getCachedTurkishKeys,
};
