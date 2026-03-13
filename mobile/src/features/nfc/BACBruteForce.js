/**
 * BAC anahtar listesi yönetimi — çok sayıda anahtarı sırayla denemek için.
 * Gerçek BAC denemesi NfcPassportReader (native) ile yapılır; bu sınıf sadece anahtar listesini
 * ve ilerleme bilgisini tutar.
 */
import { getTurkishIdBacKeys, getCachedTurkishKeys } from '../../utils/turkishIdBacKeys';
import { getPassportBacKeys, getPassportBacKeysForCountry, getCachedPassportKeys } from '../../utils/passportBacKeys';

function toYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  if (/^\d{6}$/.test(s)) return `19${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  return s.replace(/\./g, '-');
}

function normalizeBACKey(key) {
  if (!key) return null;
  const documentNo = (key.documentNo ?? key.passportNumber ?? key.documentNumber ?? '').trim().replace(/\s/g, '');
  const birthDate = toYYYYMMDD(key.birthDate);
  const expiryDate = toYYYYMMDD(key.expiryDate);
  if (!documentNo || !birthDate || !expiryDate) return null;
  return { documentNo, birthDate, expiryDate };
}

const DEFAULT_BATCH_SIZE = 50;
const MAX_KEYS_CAP = 2000;

/**
 * Denenecek BAC anahtarlarını topla: cache (önce), sonra Türk kimlik / pasaport listeleri.
 * Hepsi { documentNo, birthDate, expiryDate } formatında.
 * @param {{ documentType?: string; countryCode?: string }} options
 * @returns {Promise<Array<{ documentNo: string; birthDate: string; expiryDate: string }>>}
 */
export async function getExpandedBACKeys(options = {}) {
  const docType = (options.documentType || '').toLowerCase();
  const countryCode = (options.countryCode || 'TUR').toUpperCase().slice(0, 3);
  const seen = new Set();
  const add = (key) => {
    const n = normalizeBACKey(key);
    if (!n) return;
    const id = `${n.documentNo}|${n.birthDate}|${n.expiryDate}`;
    if (seen.has(id)) return;
    seen.add(id);
    list.push(n);
  };

  const list = [];

  // 1) Cache'den (başarılı denemeler) — önce TUR, sonra ilgili ülke
  const cachedTur = await getCachedTurkishKeys();
  cachedTur.forEach(add);
  if (countryCode !== 'TUR') {
    const cachedCountry = await getCachedPassportKeys(countryCode);
    cachedCountry.forEach(add);
  }

  // 2) Türk kimlik anahtarları
  const turkishKeys = getTurkishIdBacKeys();
  turkishKeys.forEach((k) => add({ documentNo: k.documentNo, birthDate: k.birthDate, expiryDate: k.expiryDate }));

  // 3) Pasaport anahtarları + ülke özel
  const passportKeys = getPassportBacKeys();
  passportKeys.forEach((k) => add(k));
  getPassportBacKeysForCountry(countryCode).forEach(add);

  return list.slice(0, MAX_KEYS_CAP);
}

/**
 * Sınıf: belge tipi/ülkeye göre anahtar listesi ve batch ilerlemesi.
 */
export class BACBruteForce {
  constructor() {
    this.keys = [];
    this.currentIndex = 0;
    this.batchSize = DEFAULT_BATCH_SIZE;
    this.maxAttempts = MAX_KEYS_CAP;
  }

  /**
   * Anahtar listesini yükle (async).
   * @param {string} [documentType] 'id_card' | 'passport' | ''
   * @param {string} [countryCode] ISO 3 harf
   */
  async initialize(documentType, countryCode) {
    this.keys = await getExpandedBACKeys({ documentType, countryCode });
    this.currentIndex = 0;
    return this.keys.length;
  }

  /**
   * Sonraki batch anahtarlarını döndür (ilerleme için).
   * @returns {Array<{ documentNo: string; birthDate: string; expiryDate: string }>}
   */
  getNextBatch() {
    const start = this.currentIndex;
    const batch = this.keys.slice(start, start + this.batchSize);
    this.currentIndex = Math.min(start + this.batchSize, this.keys.length);
    return batch;
  }

  get progress() {
    const total = this.keys.length;
    return total ? this.currentIndex / total : 0;
  }

  get currentAttempt() {
    return this.currentIndex;
  }

  get totalAttempts() {
    return this.keys.length;
  }

  get hasMore() {
    return this.currentIndex < this.keys.length;
  }
}

export default {
  getExpandedBACKeys,
  BACBruteForce,
};
