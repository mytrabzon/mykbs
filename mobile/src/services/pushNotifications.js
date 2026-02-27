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

/** getBackendToken: () => Promise<string | null> veya string | null — backend JWT döndürmeli */
export async function registerPushToken(getBackendToken) {
  const token = typeof getBackendToken === 'function' ? await getBackendToken() : getBackendToken;
  if (!token) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') {
      logger.log('[Push] Permission not granted');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
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
