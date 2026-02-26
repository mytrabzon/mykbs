/**
 * Backend artık yalnızca Supabase Edge Functions.
 * Eski API_BASE_URL / Node backend referansları kaldırıldı.
 */

export function buildApiUrl(path: string): string {
  const { url } = (() => {
    if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) {
      return { url: process.env.EXPO_PUBLIC_SUPABASE_URL };
    }
    try {
      const Constants = require('expo-constants').default;
      const extra = Constants.expoConfig?.extra ?? {};
      return { url: extra.supabaseUrl || '' };
    } catch {
      return { url: '' };
    }
  })();
  const base = (url || '').replace(/\/$/, '');
  return base ? `${base}/functions/v1/${path.replace(/^\//, '')}` : '';
}
