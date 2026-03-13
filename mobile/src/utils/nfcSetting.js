import AsyncStorage from '@react-native-async-storage/async-storage';

const NFC_ENABLED_KEY = '@mykbs:app_nfc_enabled';

/** Varsayılan: NFC açık (MRZ sonrası NFC akışı aktif). */
const DEFAULT_NFC_ENABLED = true;

/**
 * Uygulama içi NFC ile okuma açık mı? (Ayarlardan açılıp kapatılır.)
 * @returns {Promise<boolean>}
 */
export async function getNfcEnabled() {
  try {
    const v = await AsyncStorage.getItem(NFC_ENABLED_KEY);
    if (v == null) return DEFAULT_NFC_ENABLED;
    return v === 'true';
  } catch {
    return DEFAULT_NFC_ENABLED;
  }
}

/**
 * NFC ile okumayı aç/kapat.
 * @param {boolean} enabled
 */
export async function setNfcEnabled(enabled) {
  await AsyncStorage.setItem(NFC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export { NFC_ENABLED_KEY, DEFAULT_NFC_ENABLED };
