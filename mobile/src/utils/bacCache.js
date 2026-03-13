/**
 * Başarılı BAC anahtarlarını cihazda cache'le; bir sonraki okumada önce bunlar denenir.
 * Ülke kodu (TUR, USA, GBR vb.) ile saklanır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BAC_CACHE_KEY = '@mykbs:bac_success_cache';
const CACHE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

/**
 * Başarılı bir BAC anahtarını cache'e ekle.
 * @param {string} countryCode ISO 3 harf (TUR, USA, GBR ...)
 * @param {{ documentNo?: string; documentNumber?: string; birthDate: string; expiryDate: string }} key
 */
export async function storeSuccessfulKey(countryCode, key) {
  if (!countryCode || !key) return;
  const code = String(countryCode).toUpperCase().slice(0, 3);
  const documentNo = (key.documentNo ?? key.documentNumber ?? '').trim();
  const birthDate = (key.birthDate ?? '').trim();
  const expiryDate = (key.expiryDate ?? '').trim();
  if (!documentNo || !birthDate || !expiryDate) return;
  try {
    const raw = await AsyncStorage.getItem(BAC_CACHE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data[code]) data[code] = [];
    const entry = { documentNo, birthDate, expiryDate, timestamp: Date.now() };
    const exists = data[code].some(
      (e) => e.documentNo === documentNo && e.birthDate === birthDate && e.expiryDate === expiryDate
    );
    if (!exists) {
      data[code].push(entry);
      await AsyncStorage.setItem(BAC_CACHE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    if (__DEV__) console.warn('[bacCache] store error', e?.message);
  }
}

/**
 * Cache'den başarılı BAC anahtarlarını al (sadece son 30 gün).
 * @param {string} countryCode ISO 3 harf
 * @returns {Promise<Array<{ documentNo: string; birthDate: string; expiryDate: string }>>}
 */
export async function getSuccessfulKeys(countryCode) {
  if (!countryCode) return [];
  const code = String(countryCode).toUpperCase().slice(0, 3);
  try {
    const raw = await AsyncStorage.getItem(BAC_CACHE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    const list = data[code] || [];
    const now = Date.now();
    const fresh = list
      .filter((e) => now - (e.timestamp || 0) < CACHE_EXPIRY_MS)
      .map((e) => ({
        documentNo: e.documentNo,
        birthDate: e.birthDate,
        expiryDate: e.expiryDate,
      }));
    return fresh;
  } catch (_) {
    return [];
  }
}

export default {
  storeSuccessfulKey,
  getSuccessfulKeys,
};
