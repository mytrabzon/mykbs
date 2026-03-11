/**
 * Son okunan MRZ'yi BAC (NFC) için sakla.
 * TC Kimlik / Pasaport çipi MRZ ile açılır; check-in'de "NFC ile Okut" bu veriyi kullanır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mykbs:last_mrz_for_bac';

function toYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  return s.replace(/\./g, '-');
}

/**
 * @param {{ passportNumber?: string; documentNumber?: string; birthDate?: string; expiryDate?: string }} payload
 */
export async function setLastMrzForBac(payload) {
  if (!payload) return;
  const docNo = (payload.passportNumber ?? payload.documentNumber ?? '').trim();
  const birth = toYYYYMMDD(payload.birthDate);
  const expiry = toYYYYMMDD(payload.expiryDate);
  if (!docNo || !birth || !expiry) return;
  try {
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ documentNo: docNo, birthDate: birth, expiryDate: expiry })
    );
  } catch (_) {}
}

/**
 * @returns {Promise<{ documentNo: string; birthDate: string; expiryDate: string } | null>}
 */
export async function getLastMrzForBac() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o && o.documentNo && o.birthDate && o.expiryDate) return o;
    return null;
  } catch (_) {
    return null;
  }
}

/** Türk kimlik kartı için denenecek varsayılan BAC anahtarları (MRZ olmadan). documentNo 9 karakter, birth/expiry YYMMDD. */
export function getDefaultBacKeysForTurkishId() {
  const birth = '900101';
  const expiry = '300101';
  return [
    { documentNo: '000000000', birthDate: birth, expiryDate: expiry },
    { documentNo: '111111111', birthDate: birth, expiryDate: expiry },
    { documentNo: '123456789', birthDate: birth, expiryDate: expiry },
    { documentNo: 'A1B2C3D4E', birthDate: birth, expiryDate: expiry },
    { documentNo: '00000000000', birthDate: birth, expiryDate: expiry },
    { documentNo: '11111111111', birthDate: birth, expiryDate: expiry },
    { documentNo: '12345678901', birthDate: birth, expiryDate: expiry },
  ];
}
