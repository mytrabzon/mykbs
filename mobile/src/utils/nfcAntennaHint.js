/**
 * NFC anten konumu — marka/modele göre kullanıcıya "kartı nereye hizalayın" ipucu.
 * Anten konumu cihaza göre değişir; doğru hizalama 1–2 saniyede okuma sağlar.
 */
import { Platform } from 'react-native';

/** Cihaz markası (Android'de runtime'da alınabilir; şimdilik sabit/OS bazlı). */
const MANUFACTURER_HINT = {
  apple: 'Kartı telefonun üst kısmına (kamera yakını) hizalayın — anında okunur.',
  samsung: 'Kartı telefonun ortasına (arkaya) hizalayın — anında okunur.',
  xiaomi: 'Kartı telefonun alt kısmına hizalayın — anında okunur.',
  default: 'Kartı telefonun arkasına tam yaslayıp sabit tutun.',
};

/**
 * Cihaz markasını tahmin et (Android'de Build.MANUFACTURER yoksa OS ile).
 * İsteğe bağlı: expo-application / react-native-device-info ile gerçek manufacturer alınabilir.
 */
function getManufacturerHint() {
  if (Platform.OS === 'ios') return MANUFACTURER_HINT.apple;
  // Android'de manufacturer bilgisi olmadan genel ipucu
  try {
    const brand = (Platform.constants?.Brand || Platform.constants?.Manufacturer || '').toLowerCase();
    if (brand.includes('samsung')) return MANUFACTURER_HINT.samsung;
    if (brand.includes('xiaomi') || brand.includes('redmi')) return MANUFACTURER_HINT.xiaomi;
  } catch (_) {}
  return MANUFACTURER_HINT.default;
}

/**
 * Kısa tek cümle: "Üst kısma hizalayın" / "Ortaya hizalayın" vb.
 */
export function getNfcAntennaShortHint() {
  if (Platform.OS === 'ios') return 'Üst kısma (kamera yakını) hizalayın';
  return 'Arkaya tam yaslayıp sabit tutun';
}

/**
 * Uzun açıklama (ekranda gösterilecek).
 */
export function getNfcAntennaMessage() {
  return getManufacturerHint();
}

/**
 * İlerleme mesajına eklenebilecek kısa ipucu.
 */
export function getNfcAntennaSuffix() {
  const short = getNfcAntennaShortHint();
  return ` • ${short}`;
}

export default {
  getNfcAntennaShortHint,
  getNfcAntennaMessage,
  getNfcAntennaSuffix,
};
