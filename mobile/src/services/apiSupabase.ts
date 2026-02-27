/**
 * Tek backend: config/api.ts tek kaynak. Health test ve API çağrıları aynı base URL'i kullanır.
 */
import { callFn, EdgeFunctionError } from '../lib/supabase/functions';
import { logger } from '../utils/logger';
import { getApiBaseUrl } from '../config/api';

export function getBackendUrl(): string {
  return getApiBaseUrl();
}

/** API hata mesajı: 401/403 -> oturum, 404 -> endpoint, network -> bağlantı */
export function getApiErrorMessage(err: unknown): string {
  const status = (err as { response?: { status?: number } })?.response?.status;
  const message = (err as Error)?.message || '';
  if (status === 401 || status === 403) return 'Giriş gerekli.';
  if (status === 404) return 'İstek yapılan adres bulunamadı.';
  if (message.includes('Network') || message.includes('fetch') || message.includes('Bağlantı')) return 'Bağlantı hatası. İnterneti kontrol edin.';
  return message || 'Bir hata oluştu.';
}

export type ApiTokenProvider = () => Promise<string | null> | string | null;

let tokenProvider: ApiTokenProvider | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiTokenProvider(provider: ApiTokenProvider | null) {
  tokenProvider = provider;
}

/** 401 alındığında çağrılır; AuthContext logout yapar. */
export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

async function getToken(): Promise<string | null> {
  if (!tokenProvider) return null;
  const t = tokenProvider();
  return t instanceof Promise ? t : Promise.resolve(t);
}

function parsePath(path: string): { pathname: string; query: Record<string, string> } {
  const [pathname, qs] = path.split('?');
  const query: Record<string, string> = {};
  if (qs) {
    qs.split('&').forEach((p) => {
      const [k, v] = p.split('=');
      if (k && v) query[decodeURIComponent(k)] = decodeURIComponent(v);
    });
  }
  return { pathname: pathname || '', query };
}

/** Axios-benzeri response: { data } */
function toResponse<T>(data: T): { data: T } {
  return { data };
}

/** Hata yakalayıp axios-benzeri error.response ile fırlat; 401 ise (ve zaten token varken) onUnauthorized çağır. Token yokken 401 = henüz yüklenmedi, lobiye atma. */
async function wrapError(err: unknown): Promise<never> {
  if (err instanceof EdgeFunctionError) {
    const skipAuthRedirect = (err as EdgeFunctionError & { skipAuthRedirect?: boolean }).skipAuthRedirect;
    if (err.status === 401 && !skipAuthRedirect && onUnauthorized) {
      const hadToken = await getToken();
      if (hadToken) {
        try {
          onUnauthorized();
        } catch (e) {
          logger.error('onUnauthorized error', e);
        }
      }
    }
    throw Object.assign(new Error(err.message), {
      response: { status: err.status, data: err.data },
      message: err.message,
    });
  }
  throw err;
}

export const api = {
  defaults: { headers: { common: {} as Record<string, string> } },

  async get(path: string, _config?: { timeout?: number }) {
    const { pathname, query } = parsePath(path);
    const token = await getToken();
    try {
      if (pathname === '/health' || pathname === 'health') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/health`, { method: 'GET' });
          const data = await r.json().catch(() => ({}));
          return toResponse(data || { ok: true, status: 'ok' });
        }
        const res = await callFn<{ status?: string }>('health', {}, null);
        return toResponse(res || { status: 'ok' });
      }
      if (pathname === '/auth/me' || pathname === 'auth/me') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetch(`${backendUrl}/api/auth/me`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Bilgi alınamadı'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const [meData, facilitiesData] = await Promise.all([
          callFn<{ user_id: string; branch_id: string; role: string; display_name: string | null; title?: string | null; avatar_url?: string | null }>('me', {}, token),
          callFn<{ tesis: Record<string, unknown>; ozet?: unknown }>('facilities_list', {}, token),
        ]);
        const kullanici = {
          id: meData?.user_id,
          uid: meData?.user_id,
          adSoyad: meData?.display_name || 'Kullanıcı',
          rol: meData?.role || 'staff',
          biyometriAktif: false,
          yetkiler: { checkIn: true, odaDegistirme: true, bilgiDuzenleme: true },
        };
        const tesis = facilitiesData?.tesis || {};
        return toResponse({ kullanici, tesis });
      }
      if (pathname === '/tesis' || pathname === 'tesis') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/tesis`, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Tesis alınamadı'), { response: { status: r.status, data } });
          return toResponse(data as { tesis: unknown; ozet: unknown });
        }
        const res = await callFn('facilities_list', {}, token);
        return toResponse(res as { tesis: unknown; ozet: unknown });
      }
      if (pathname.startsWith('/tesis/kbs') || pathname === 'tesis/kbs') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/tesis/kbs`, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Yetkisiz'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('settings_get', {}, token);
        return toResponse(res);
      }
      if (pathname === '/oda' || pathname === 'oda') {
        const filtre = query.filtre || 'tumu';
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/oda?filtre=${encodeURIComponent(filtre)}`, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Odalar alınamadı'), { response: { status: r.status, data } });
          return toResponse({ odalar: (data as { odalar?: unknown[] }).odalar ?? [] });
        }
        const res = await callFn<{ odalar?: unknown[] }>('rooms_list', { filtre }, token);
        return toResponse({ odalar: res?.odalar ?? res ?? [] });
      }
      const odaMatch = pathname.match(/^\/?oda\/([^/]+)$/);
      if (odaMatch) {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/oda/${odaMatch[1]}`, {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Oda alınamadı'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('room_get', { id: odaMatch[1] }, token);
        return toResponse(res);
      }
      logger.warn('[apiSupabase] Unmapped GET', path);
      const res = await callFn('facilities_list', {}, token);
      return toResponse(res);
    } catch (e) {
      await wrapError(e);
    }
  },

  async post(path: string, body?: Record<string, unknown> | FormData, _config?: { headers?: Record<string, string>; timeout?: number }) {
    const pathname = path.replace(/\?.*$/, '');
    const token = await getToken();
    const payload: Record<string, unknown> = body && !(body instanceof FormData) ? body as Record<string, unknown> : {};

    try {
      if (pathname === '/auth/giris' || pathname === 'auth/giris') {
        const res = await callFn('auth_login', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/aktivasyon' || pathname === 'auth/aktivasyon') {
        const res = await callFn('auth_aktivasyon', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/pin' || pathname === 'auth/pin') {
        const res = await callFn('auth_pin', payload, token);
        return toResponse(res);
      }
      if (pathname === '/auth/sifre' || pathname === 'auth/sifre') {
        const res = await callFn('auth_sifre', payload, token);
        return toResponse(res);
      }
      if (pathname === '/auth/sifre-sifirla/otp-iste' || pathname === 'auth/sifre-sifirla/otp-iste') {
        const backendUrl = getBackendUrl();
        if (!backendUrl) throw new Error('Sunucu adresi eksik. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
        const r = await fetch(`${backendUrl}/api/auth/sifre-sifirla/otp-iste`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Kod gönderilemedi'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/sifre-sifirla' || pathname === 'auth/sifre-sifirla') {
        const backendUrl = getBackendUrl();
        if (!backendUrl) throw new Error('Sunucu adresi eksik. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
        const accessToken = (payload?.access_token as string) || '';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
        const r = await fetch(`${backendUrl}/api/auth/sifre-sifirla`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Şifre güncellenemedi'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/giris/yeni' || pathname === 'auth/giris/yeni') {
        // KBS şifre ile giriş: Node backend token döner; Edge sadece OTP gönderir.
        const backendUrl = getBackendUrl();
        if (backendUrl && (payload.telefon || payload.email) && payload.sifre) {
          const r = await fetch(`${backendUrl}/api/auth/giris/yeni`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Giriş başarısız'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('auth_request_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/giris/otp-iste' || pathname === 'auth/giris/otp-iste') {
        const res = await callFn('auth_request_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/giris/otp-dogrula' || pathname === 'auth/giris/otp-dogrula') {
        const res = await callFn('auth_verify_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/supabase-phone-session' || pathname === 'auth/supabase-phone-session') {
        const res = await callFn('auth_supabase_phone_session', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/kayit' || pathname === 'auth/kayit') {
        const res = await callFn('auth_request_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/kayit/otp-iste' || pathname === 'auth/kayit/otp-iste') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/auth/kayit/otp-iste`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telefon: payload.telefon }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'SMS gönderilemedi'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('auth_request_otp', { ...payload, islemTipi: 'kayit' }, null);
        return toResponse(res);
      }
      if (pathname === '/auth/kayit/dogrula' || pathname === 'auth/kayit/dogrula') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/auth/kayit/dogrula`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Kayıt tamamlanamadı'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('auth_verify_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/kayit/supabase-verify-otp' || pathname === 'auth/kayit/supabase-verify-otp') {
        const backendUrl = getBackendUrl();
        if (!backendUrl) throw new Error('Sunucu adresi eksik. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
        const r = await fetch(`${backendUrl}/api/auth/kayit/supabase-verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: payload.phone, token: payload.token }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Doğrulama başarısız'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/kayit/supabase-create' || pathname === 'auth/kayit/supabase-create') {
        const backendUrl = getBackendUrl();
        if (!backendUrl) throw new Error('Sunucu adresi eksik. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
        const r = await fetch(`${backendUrl}/api/auth/kayit/supabase-create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Kayıt tamamlanamadı'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/basvuru' || pathname === 'auth/basvuru') {
        const res = await callFn('auth_basvuru', payload, null);
        return toResponse(res);
      }
      if (pathname === '/nfc/okut' || pathname === 'nfc/okut') {
        const res = await callFn('nfc_read', payload, token);
        return toResponse(res);
      }
      if (pathname === '/ocr/mrz' || pathname === 'ocr/mrz') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token && body instanceof FormData) {
          const r = await fetch(`${backendUrl}/api/ocr/mrz`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: body as FormData,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'MRZ okunamadı'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data as { success: boolean; raw: string });
        }
        throw new Error('MRZ için sunucu adresi ve giriş gerekli.');
      }
      if (pathname === '/ocr/okut' || pathname === 'ocr/okut') {
        if (body instanceof FormData) {
          const imagePart = body.get('image') as { uri?: string } | null;
          const uri = imagePart?.uri;
          if (uri) {
            try {
              const FileSystem = require('expo-file-system').default;
              const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              payload.imageBase64 = base64;
            } catch (e) {
              logger.error('OCR image read error', e);
            }
          }
        }
        const res = await callFn('document_scan', payload, token);
        return toResponse(res);
      }
      if (pathname === '/misafir/checkin' || pathname === 'misafir/checkin') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetch(`${backendUrl}/api/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const e = new EdgeFunctionError((data as { message?: string })?.message || 'Check-in başarısız', r.status, undefined, data);
            (e as EdgeFunctionError & { skipAuthRedirect?: boolean }).skipAuthRedirect = true;
            throw e;
          }
          return toResponse({ success: true, message: (data as { message?: string })?.message || 'Check-in kaydedildi', guestId: (data as { guestId?: string })?.guestId });
        }
        const res = await callFn('checkin_create', payload, token);
        return toResponse(res);
      }
      if (pathname.includes('/kyc/mrz-verify') || pathname.includes('kyc/mrz-verify')) {
        const res = await callFn('document_scan', payload, token);
        return toResponse(res);
      }
      if (pathname === '/tesis/kbs/test' || pathname === 'tesis/kbs/test') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetch(`${backendUrl}/api/tesis/kbs/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'KBS test başarısız'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data);
        }
        const res = await callFn('settings_kbs_test', {}, token);
        return toResponse(res);
      }
      if (pathname === '/tesis/kbs/talebi' || pathname === 'tesis/kbs/talebi') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetch(`${backendUrl}/api/tesis/kbs/talebi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload || {}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Talep gönderilemedi'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        throw new Error('Sunucu adresi tanımlı değil');
      }
      if (pathname === '/notification_submit' || pathname === 'notification_submit') {
        const res = await callFn('notification_submit', payload, token);
        return toResponse(res);
      }
      if (pathname === '/oda' || pathname === 'oda') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetch(`${backendUrl}/api/oda`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload || {}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'Oda eklenemedi'), { response: { status: r.status, data } });
          }
          return toResponse(data);
        }
        throw new Error('Oda eklemek için sunucu adresi ve giriş gerekli. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
      }
      const checkoutMatch = pathname.match(/^\/?misafir\/checkout\/([^/]+)$/);
      if (checkoutMatch) {
        const guestId = checkoutMatch[1];
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetch(`${backendUrl}/api/checkout/${guestId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            const e = new EdgeFunctionError((data as { message?: string })?.message || 'Çıkış başarısız', r.status, undefined, data);
            (e as EdgeFunctionError & { skipAuthRedirect?: boolean }).skipAuthRedirect = true;
            throw e;
          }
          return toResponse({ success: true, message: (data as { message?: string })?.message || 'Çıkış yapıldı' });
        }
        const res = await callFn('checkout', { misafirId: guestId }, token);
        return toResponse(res);
      }
      logger.warn('[apiSupabase] Unmapped POST', path);
      return toResponse(await callFn(pathname.replace(/^\//, '').replace(/\//g, '_'), payload, token));
    } catch (e) {
      await wrapError(e);
    }
  },

  async put(path: string, body?: Record<string, unknown>) {
    const pathname = path.replace(/\?.*$/, '');
    const token = await getToken();
    try {
      if (pathname === '/tesis/kbs' || pathname === 'tesis/kbs') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetch(`${backendUrl}/api/tesis/kbs`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body || {}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Ayarlar kaydedilemedi'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('settings_update', (body || {}) as Record<string, unknown>, token);
        return toResponse(res);
      }
      logger.warn('[apiSupabase] Unmapped PUT', path);
      return toResponse(await callFn('settings_update', (body || {}) as Record<string, unknown>, token));
    } catch (e) {
      await wrapError(e);
    }
  },

  async delete(path: string) {
    const token = await getToken();
    const match = path.match(/\/misafir\/checkout\/([^/]+)/);
    if (match) {
      try {
        const res = await callFn('checkout', { misafirId: match[1] }, token);
        return toResponse(res);
      } catch (e) {
        await wrapError(e);
      }
    }
    logger.warn('[apiSupabase] Unmapped DELETE', path);
    return toResponse({});
  },
};
