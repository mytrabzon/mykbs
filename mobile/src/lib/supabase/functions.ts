import { supabase, refreshSessionWithRetry } from './supabase';
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

  // Backend ile girişte Supabase token AsyncStorage'da olur, session boş olabilir. tokenOverride verilmişse önce onu kullan (bildirimler vb.).
  let accessToken: string | null = null;
  const override = opts.tokenOverride && typeof opts.tokenOverride === 'string' && !opts.tokenOverride.startsWith('stub_token_') ? opts.tokenOverride : null;
  if (override) {
    accessToken = override;
  } else if (requireAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  }
  if (!accessToken) {
    accessToken = opts.tokenOverride ?? null;
  }
  if (typeof accessToken === 'string' && accessToken.startsWith('stub_token_')) {
    accessToken = null;
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

  const isRoomsList = name === 'rooms_list';
  logger.log(isRoomsList ? '[callFn] odalar (rooms_list)' : '[callFn]', {
    name,
    hasBody: !!body,
    hasToken: !!accessToken,
    tokenLength: accessToken ? accessToken.length : 0,
    url: fnUrl,
    ...(isRoomsList && body ? { filtre: (body as { filtre?: string }).filtre } : {}),
  });

  let res = await fetch(fnUrl, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text || res.statusText };
  }

  if (res.status === 401 && requireAuth && (name === 'me' || name === 'facilities_list' || name === 'rooms_list' || name === 'upload_community_image' || name === 'profile_update' || name === 'upload_avatar' || name === 'in_app_notifications_list' || name === 'in_app_notifications_mark_read')) {
    const { data: { session: refreshed } } = await refreshSessionWithRetry();
    const newToken = refreshed?.access_token;
    if (newToken) {
      logger.log('[callFn] 401 sonrası session yenilendi, tekrar deniyor', { name });
      res = await fetch(fnUrl, {
        method: 'POST',
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      text = await res.text();
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text || res.statusText };
      }
    }
  }

  const bodyObj = data as { ok?: boolean; code?: string; message?: string };
  const backendCode = (data as { code?: string })?.code;
  const backendMessage = (data as { message?: string })?.message;
  if (isRoomsList) {
    logger.log('[callFn] rooms_list yanıt', {
      status: res.status,
      ok: res.ok,
      code: backendCode,
      message: backendMessage,
      hasOdalar: !!(data as { odalar?: unknown[] })?.odalar,
      odalarLength: (data as { odalar?: unknown[] })?.odalar?.length ?? 0,
    });
  } else {
    logger.log('[callFn response]', {
      name,
      status: res.status,
      ok: res.ok,
      bodyPreview: typeof backendMessage === 'string' ? backendMessage : res.ok ? 'ok' : (typeof text === 'string' ? text?.slice(0, 120) : ''),
    });
  }

  if (!res.ok) {
    const message = backendMessage || res.statusText || 'Edge Function error';
    const prefix = isRoomsList ? 'Odalar (Supabase): ' : '';
    if (res.status === 401) {
      logger.error('[callFn] 401 Unauthorized', { name, backendMessage, code: backendCode });
      throw new EdgeFunctionError(prefix + 'Giriş gerekli', 401, backendCode || 'UNAUTHORIZED', data);
    }
    if (res.status === 404) {
      throw new EdgeFunctionError(prefix + 'Endpoint bulunamadı', 404, 'NOT_FOUND', data);
    }
    if (res.status === 403) {
      const msg = backendMessage || 'Bu işlem için yetkiniz yok';
      throw new EdgeFunctionError(prefix + msg, 403, backendCode || 'FORBIDDEN', data);
    }
    if (res.status === 429) {
      throw new EdgeFunctionError(prefix + 'Çok fazla istek, lütfen bekleyin', 429, 'RATE_LIMIT', data);
    }
    if (res.status >= 500) {
      throw new EdgeFunctionError(prefix + (backendMessage || 'Sunucu hatası, lütfen tekrar deneyin'), res.status, backendCode || 'SERVER_ERROR', data);
    }
    throw new EdgeFunctionError(prefix + message, res.status, backendCode, data);
  }

  return data as T;
}
