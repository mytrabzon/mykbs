import { supabase } from './supabase';
import { logger } from '../../utils/logger';

const getConfig = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) {
    return {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      functionsUrl: process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || `${(process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1`,
      useTrpc: process.env.EXPO_PUBLIC_USE_TRPC === 'true',
    };
  }
  try {
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    const url = extra.supabaseUrl || '';
    return {
      url,
      anonKey: extra.supabaseAnonKey || '',
      functionsUrl: extra.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || (url ? `${String(url).replace(/\/$/, '')}/functions/v1` : ''),
      useTrpc: extra.EXPO_PUBLIC_USE_TRPC === true || extra.EXPO_PUBLIC_USE_TRPC === 'true',
    };
  } catch {
    return { url: '', anonKey: '', functionsUrl: '', useTrpc: false };
  }
};

export class EdgeFunctionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'EdgeFunctionError';
  }
}

/**
 * Supabase Edge Function çağrısı – tek giriş noktası.
 * Session token: tokenOverride verilirse o kullanılır, yoksa supabase.auth.getSession().
 */
export async function callFn<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
  tokenOverride?: string | null
): Promise<T> {
  const { url, anonKey } = getConfig();
  if (!url || !anonKey) {
    throw new EdgeFunctionError('Supabase URL veya Anon Key eksik. mobile/.env içinde EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY (tam JWT) olmalı.', 0, 'CONFIG_MISSING');
  }
  if (anonKey.length < 30) {
    logger.warn('[callFn] API key çok kısa (publishable: sb_publishable_... veya anon JWT). Dashboard → Settings → API.');
  }

  const baseUrl = url.replace(/\/$/, '');
  const fnUrl = `${baseUrl}/functions/v1/${name}`;

  let accessToken: string | null = tokenOverride ?? null;
  const tokenSource = accessToken ? 'override' : 'session';
  if (typeof accessToken === 'string' && accessToken.startsWith('stub_token_')) {
    accessToken = null;
  }
  if (!accessToken && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': anonKey,
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Test modu: detaylı log (token kaynağı, uzunluk, endpoint)
  logger.log('[callFn]', {
    name,
    hasBody: !!body,
    hasToken: !!accessToken,
    tokenSource: accessToken ? tokenSource : 'none',
    tokenLength: accessToken ? accessToken.length : 0,
    url: fnUrl,
  });

  const res = await fetch(fnUrl, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text || res.statusText };
  }

  // Test modu: yanıt özeti
  logger.log('[callFn response]', {
    name,
    status: res.status,
    ok: res.ok,
    bodyPreview: typeof (data as { message?: string })?.message === 'string'
      ? (data as { message?: string }).message
      : res.ok ? 'ok' : text?.slice(0, 120),
  });

  if (!res.ok) {
    const message = (data as { message?: string })?.message || res.statusText || 'Edge Function error';
    if (res.status === 401) {
      logger.error('[callFn] 401 Unauthorized', { name, backendMessage: (data as { message?: string })?.message, fullBody: data });
      throw new EdgeFunctionError('Giriş gerekli', 401, 'UNAUTHORIZED', data);
    }
    if (res.status === 404) {
      throw new EdgeFunctionError('Endpoint bulunamadı', 404, 'NOT_FOUND', data);
    }
    if (res.status === 403) {
      throw new EdgeFunctionError('Bu işlem için yetkiniz yok', 403, 'FORBIDDEN', data);
    }
    if (res.status === 429) {
      throw new EdgeFunctionError('Çok fazla istek, lütfen bekleyin', 429, 'RATE_LIMIT', data);
    }
    if (res.status >= 500) {
      throw new EdgeFunctionError('Sunucu hatası, lütfen tekrar deneyin', res.status, 'SERVER_ERROR', data);
    }
    throw new EdgeFunctionError(message, res.status, undefined, data);
  }

  return data as T;
}
