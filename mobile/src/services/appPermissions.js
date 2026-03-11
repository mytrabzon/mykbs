/**
 * Uygulama izinleri: kamera, galeri, bildirimler.
 * Durum kontrolü ve istek; kaldırmak için cihaz ayarlarına yönlendirme.
 */
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getNotificationPermissionStatusAsync,
  requestNotificationPermissionAsync,
} from './pushNotifications';
import { logger } from '../utils/logger';

const STATUS_GRANTED = 'granted';
const STATUS_DENIED = 'denied';
const STATUS_UNDETERMINED = 'undetermined';

/**
 * Tüm uygulama izinlerinin mevcut durumunu getirir.
 * @returns {Promise<{ camera: string, mediaLibrary: string, notifications: string }>}
 */
export async function getAppPermissionsAsync() {
  try {
    const [camera, mediaLibrary, notifications] = await Promise.all([
      ImagePicker.getCameraPermissionsAsync().then((r) => r.status),
      ImagePicker.getMediaLibraryPermissionsAsync?.()
        ? ImagePicker.getMediaLibraryPermissionsAsync().then((r) => r.status)
        : Promise.resolve(STATUS_UNDETERMINED),
      getNotificationPermissionStatusAsync(),
    ]);
    return { camera, mediaLibrary, notifications };
  } catch (e) {
    logger.warn('[Permissions] getAppPermissionsAsync failed', e?.message);
    return {
      camera: STATUS_UNDETERMINED,
      mediaLibrary: STATUS_UNDETERMINED,
      notifications: STATUS_UNDETERMINED,
    };
  }
}

/**
 * Kamera iznini iste.
 * @returns {Promise<'granted'|'denied'|'undetermined'>}
 */
export async function requestCameraPermissionAsync() {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status;
  } catch (e) {
    logger.warn('[Permissions] requestCameraPermissionAsync failed', e?.message);
    return 'denied';
  }
}

/**
 * Medya galerisi iznini iste.
 * @returns {Promise<'granted'|'denied'|'undetermined'>}
 */
export async function requestMediaLibraryPermissionAsync() {
  try {
    if (!ImagePicker.requestMediaLibraryPermissionsAsync) {
      return STATUS_UNDETERMINED;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status;
  } catch (e) {
    logger.warn('[Permissions] requestMediaLibraryPermissionAsync failed', e?.message);
    return 'denied';
  }
}

export { requestNotificationPermissionAsync } from './pushNotifications';

/**
 * Uygulama ayarlarını aç (kullanıcı izinleri buradan kaldırabilir / verebilir).
 */
export async function openAppSettingsAsync() {
  try {
    if (Linking.openSettings) {
      await Linking.openSettings();
    } else {
      await Linking.openURL('app-settings:');
    }
  } catch (e) {
    await Linking.openURL('app-settings:').catch(() => {});
  }
}
