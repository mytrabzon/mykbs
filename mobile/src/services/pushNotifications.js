/**
 * Expo Push Notifications - token al ve backend POST /push/register ile kaydet.
 * Backend JWT (getBackendToken) varsa çağrılır; Supabase Edge çağrılmaz (401 biter).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { getApiBaseUrl } from '../config/api';
import { logger } from '../utils/logger';

// Foreground'da bildirim göster
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Bildirim izin durumunu getir (kart göstermek için).
 * @returns {Promise<'granted'|'denied'|'undetermined'>}
 */
export async function getNotificationPermissionStatusAsync() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (e) {
    logger.warn('[Push] getNotificationPermissionStatusAsync failed', e?.message);
    return 'undetermined';
  }
}

/**
 * Bildirim iznini iste (lobi ekranında karttaki "İzin ver" ile çağrılır).
 * @returns {Promise<'granted'|'denied'|'undetermined'>}
 */
export async function requestNotificationPermissionAsync() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return 'granted';
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  } catch (e) {
    logger.warn('[Push] requestNotificationPermissionAsync failed', e?.message);
    return 'denied';
  }
}

/** getBackendToken: () => Promise<string | null> veya string | null — backend JWT döndürmeli */
export async function registerPushToken(getBackendToken) {
  const token = typeof getBackendToken === 'function' ? await getBackendToken() : getBackendToken;
  if (!token) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing !== 'granted') {
      logger.log('[Push] Permission not granted, skipping register (request in lobby)');
      return;
    }

    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync();
    } catch (tokenErr) {
      const msg = tokenErr?.message || '';
      if (msg.includes('FirebaseApp') || msg.includes('FCM') || msg.includes('Firebase')) {
        logger.warn('[Push] Android FCM yapılandırılmamış (google-services.json / EAS FCM credentials). Push atlanıyor.');
        return;
      }
      throw tokenErr;
    }
    const expoPushToken = tokenData?.data;
    if (!expoPushToken) {
      logger.log('[Push] No Expo push token');
      return;
    }

    const backendUrl = getApiBaseUrl();
    if (!backendUrl) {
      logger.warn('[Push] Backend URL yok, push kaydı atlanıyor');
      return;
    }

    let deviceId = null;
    try {
      deviceId = Application.androidId ?? (await Application.getIosIdForVendorAsync()) ?? null;
    } catch (_) {}

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const r = await fetch(`${backendUrl}/api/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ expoPushToken, deviceId, platform }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      logger.error('[Push] Register failed', { status: r.status, data });
      return;
    }
    logger.log('[Push] Token registered', { platform });
  } catch (e) {
    logger.error('[Push] Register error', e);
  }
}

/** KBS kimlik bildirimi gönderilirken ekranda/arka planda "Kimlik bildiriliyor" göstergesi */
const KIMLIK_BILDIRIM_CHANNEL_ID = 'kimlik-bildirim';
const KIMLIK_BILDIRIM_NOTIF_TAG = 'kimlik-bildirim-in-progress';

/**
 * Kimlik bildirimi başladığında bildirim çubuğu göster (özellikle uygulama arka plana alındığında).
 * @returns {Promise<string|null>} Dismiss için kullanılacak notification identifier veya null
 */
export async function showKimlikBildirimInProgress() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(KIMLIK_BILDIRIM_CHANNEL_ID, {
        name: 'Kimlik bildirimi',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0],
        sound: null,
      });
    }
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Kimlik bildiriliyor',
        body: 'Misafir bilgisi yetkili makamlara iletiliyor…',
        data: { tag: KIMLIK_BILDIRIM_NOTIF_TAG },
        channelId: Platform.OS === 'android' ? KIMLIK_BILDIRIM_CHANNEL_ID : undefined,
      },
      trigger: null,
    });
    return id ?? null;
  } catch (e) {
    logger.warn('[Push] showKimlikBildirimInProgress failed', e?.message);
    return null;
  }
}

/**
 * Kimlik bildirimi bittiğinde gösterilen bildirimi kaldır.
 * @param {string|null} notificationIdentifier - showKimlikBildirimInProgress dönüş değeri
 */
export async function dismissKimlikBildirimNotification(notificationIdentifier) {
  if (!notificationIdentifier) return;
  try {
    await Notifications.dismissNotificationAsync(notificationIdentifier);
  } catch (e) {
    logger.warn('[Push] dismissKimlikBildirimNotification failed', e?.message);
  }
}
