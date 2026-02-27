import { supabase } from './supabase';
import { logger } from '../../utils/logger';
import { ENV } from '../config/env';

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

/** callFn 3. parametre: token override (string | null) veya { tokenOverride, requireAuth } */
type CallFnOptions = { tokenOverride?: string | null; requireAuth?: boolean };

/**
 * Supabase Edge Function çağrısı – tek giriş noktası.
 * Authorization sadece supabase.auth.getSession() access_token ile (veya tokenOverride ile) gönderilir.
 * requireAuth: true ise token yoksa çağrı yapılmaz, 401 fırlatılır. health gibi anon çağrılar için requireAuth: false.
 */
export async function callFn<T = unknown>(
  name: string,
  body?: Record<string, unknown>,
  options?: string | null | CallFnOptions
): Promise<T> {
  const opts: CallFnOptions =
    options === null || options === undefined
      ? {}
      : typeof options === 'string'
        ? { tokenOverride: options }
        : options;
  const requireAuth = opts.requireAuth !== false;
  const baseUrl = ENV.SUPABASE_URL.replace(/\/$/, '');
  const fnUrl = `${baseUrl}/functions/v1/${name}`;

  let accessToken: string | null = opts.tokenOverride ?? null;
  if (typeof accessToken === 'string' && accessToken.startsWith('stub_token_')) {
    accessToken = null;
  }
  if (!accessToken) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }

  if (requireAuth && !accessToken) {
    logger.warn('[callFn] Token yok, çağrı yapılmıyor (requireAuth)', { name });
    throw new EdgeFunctionError('Giriş gerekli', 401, 'UNAUTHORIZED');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': ENV.SUPABASE_ANON_KEY,
  };
  // Authorization sadece session access_token (veya tokenOverride); anon key asla Bearer'a konmaz.
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  logger.log('[callFn]', {
    name,
    hasBody: !!body,
    hasToken: !!accessToken,
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
