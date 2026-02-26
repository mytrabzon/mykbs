/**
 * Tek kaynak: Backend (Node/KBS) base URL ve path'ler.
 * Test isteği (health) ve tüm API çağrıları bu değerleri kullanır.
 * Backend Express kullanıyor; tRPC yok (Supabase Edge'de ayrı tRPC var).
 */

const getEnvBackendUrl = (): string => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_URL) {
    return (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
  }
  try {
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    return String(extra.backendUrl ?? '').replace(/\/$/, '');
  } catch {
    return '';
  }
};

/** Node backend base URL (health, checkin, tesis, oda vb.) */
export function getApiBaseUrl(): string {
  return getEnvBackendUrl();
}

/** Health endpoint path – backend GET /health */
export const HEALTH_PATH = '/health';

/** Test edilen tam URL (tek otorite) */
export function getHealthUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}${HEALTH_PATH}` : '';
}

/** API base + health (debug / test ekranında gösterim) */
export function getApiDebugInfo(): { healthUrl: string; apiBaseUrl: string } {
  const apiBaseUrl = getApiBaseUrl();
  return {
    healthUrl: apiBaseUrl ? `${apiBaseUrl}${HEALTH_PATH}` : '',
    apiBaseUrl,
  };
}

/** tRPC sadece Supabase Edge'de; Node backend tRPC kullanmıyor */
export const TRPC_PATH = '/trpc';

export function getTrpcUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}${TRPC_PATH}` : '';
}

function getSupabaseBaseUrlInternal(): string {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) {
    return (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  }
  try {
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    return String(extra.supabaseUrl ?? '').replace(/\/$/, '');
  } catch {
    return '';
  }
}

/** Supabase proje base URL (functions için kullanılır) */
export function getSupabaseBaseUrl(): string {
  return getSupabaseBaseUrlInternal();
}

/** Supabase yapılandırılmış mı (URL + anon key kontrolü yapılabilir) */
export function isSupabaseConfigured(): boolean {
  return getSupabaseBaseUrlInternal().length > 0;
}

/** Supabase Edge Functions URL (tesis/oda listesi vb. – ayrı kaynak) */
export function buildApiUrl(path: string): string {
  const base = getSupabaseBaseUrlInternal();
  return base ? `${base}/functions/v1/${path.replace(/^\//, '')}` : '';
}
