/**
 * Tek kaynak: Backend (Node/KBS) base URL ve path'ler.
 * ENV (EAS build veya process.env) üzerinden okunur.
 */
import { ENV } from '../lib/config/env';

/** Node backend base URL (health, checkin, tesis, oda vb.) */
export function getApiBaseUrl(): string {
  return ENV.BACKEND_URL.replace(/\/$/, '');
}

/** Health endpoint path – backend GET /health (DB'siz) */
export const HEALTH_PATH = '/health';

/** DB ping – backend GET /health/db (teşhis: sunucu ayakta ama DB yok) */
export const HEALTH_DB_PATH = '/health/db';

/** Test edilen tam URL (tek otorite) */
export function getHealthUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}${HEALTH_PATH}` : '';
}

export function getHealthDbUrl(): string {
  const base = getApiBaseUrl();
  return base ? `${base}${HEALTH_DB_PATH}` : '';
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

/** Supabase proje base URL (functions için kullanılır) */
export function getSupabaseBaseUrl(): string {
  return ENV.SUPABASE_URL.replace(/\/$/, '');
}

/** Supabase yapılandırılmış mı (ENV ile her zaman true olur) */
export function isSupabaseConfigured(): boolean {
  return !!ENV.SUPABASE_URL;
}

/** Supabase Edge Functions URL (tesis/oda listesi vb. – ayrı kaynak) */
export function buildApiUrl(path: string): string {
  const base = ENV.SUPABASE_URL.replace(/\/$/, '');
  return base ? `${base}/functions/v1/${path.replace(/^\//, '')}` : '';
}
