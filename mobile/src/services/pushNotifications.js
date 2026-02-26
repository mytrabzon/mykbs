/**
 * Expo Push Notifications - token al ve Supabase push_register_token ile kaydet.
 * Supabase token (getSupabaseToken) varsa çağrılır.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as communityApi from './communityApi';
import { logger } from '../utils/logger';

// Foreground'da bildirim göster
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerPushToken(getSupabaseToken) {
  const supabaseToken = await getSupabaseToken?.();
  if (!supabaseToken) return;

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
    const token = tokenData?.data;
    if (!token) {
      logger.log('[Push] No Expo push token');
      return;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await communityApi.registerPushToken(token, platform, supabaseToken);
    logger.log('[Push] Token registered', { platform });
  } catch (e) {
    logger.error('[Push] Register error', e);
  }
}
