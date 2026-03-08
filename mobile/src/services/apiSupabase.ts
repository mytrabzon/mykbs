/**
 * Tek backend: config/api.ts tek kaynak. Health test ve API çağrıları aynı base URL'i kullanır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callFn, EdgeFunctionError } from '../lib/supabase/functions';
import { logger } from '../utils/logger';
import { getApiBaseUrl } from '../config/api';

const AUTH_TOKEN_KEY = '@mykbs:auth:token';

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

/** Açılışta hemen token kullanılsın: modül yüklenir yüklenmez AsyncStorage'dan okuyan sağlayıcı ayarlı. AuthContext init sonra bunu Supabase-aware sağlayıcı ile güncelleyebilir. */
function getBootstrapToken(): Promise<string | null> {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}
tokenProvider = getBootstrapToken;

export function setApiTokenProvider(provider: ApiTokenProvider | null) {
  tokenProvider = provider;
}

/** 401 alındığında çağrılır; AuthContext logout yapar. */
export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

export async function getToken(): Promise<string | null> {
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

/** Birleşik belge okuma cevabı (MRZ + ön yüz OCR) */
export interface DocumentScanResponse {
  success: boolean;
  rawText?: string;
  mrz?: string | null;
  mrzPayload?: { documentNumber: string; birthDate: string; expiryDate: string; surname: string; givenNames: string; issuingCountry: string } | null;
  front?: { ad: string; soyad: string; kimlikNo: string | null; pasaportNo: string | null; dogumTarihi: string | null; uyruk: string };
  merged?: {
    ad: string;
    soyad: string;
    kimlikNo: string | null;
    pasaportNo: string | null;
    dogumTarihi: string | null;
    uyruk: string;
    belgeNo: string;
    sonKullanma: string | null;
    ulkeKodu: string;
  };
}

/** Toplu okuma tek sonuç öğesi */
export interface DocumentBatchItem {
  index: number;
  success: boolean;
  mrz?: string | null;
  front?: { ad: string; soyad: string; kimlikNo: string | null; pasaportNo: string | null; dogumTarihi: string | null; uyruk: string };
  merged?: DocumentScanResponse['merged'];
  error?: string;
}

/** Axios-benzeri response: { data } */
function toResponse<T>(data: T): { data: T } {
  return { data };
}

/** 429 ve diğer !r.ok durumlarında anlamlı mesajla hata fırlat */
function throwIfNotOk(r: Response, data: Record<string, unknown> | null, defaultMessage: string): void {
  if (r.ok) return;
  const status = r.status;
  const message =
    status === 429
      ? 'Çok fazla istek (429). Lütfen biraz sonra tekrar deneyin.'
      : String((data as { message?: string })?.message ?? (data as { error?: string })?.error ?? defaultMessage);
  throw Object.assign(new Error(message), { response: { status, data: data ?? {} } });
}

/** Backend fetch + her request için detaylı log: full URL, status, 429 ise RATE_LIMIT ve body önizleme */
async function fetchWithLog(url: string, opts: RequestInit): Promise<Response> {
  const r = await fetch(url, opts);
  r
    .clone()
    .text()
    .then((text) => {
      let parsed: { ok?: boolean; code?: string; message?: string } = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch (_) {}
      const status = r.status;
      const is429 = status === 429;
      if (is429) {
        const bodyPreview = (text && text.length > 0) ? text.slice(0, 200) : '(boş)';
        console.log('[REQUEST]', {
          fullUrl: url,
          status,
          rateLimit: true,
          hint: 'Çok fazla istek - sunucu geçici sınır uyguluyor',
          bodyPreview: bodyPreview.length < 200 ? bodyPreview : bodyPreview + '…',
        });
      } else {
        console.log('[REQUEST]', {
          fullUrl: url,
          status,
          ok: parsed?.ok,
          code: parsed?.code,
          message: parsed?.message,
        });
      }
    })
    .catch(() => console.log('[REQUEST]', { fullUrl: url, status: r.status, body: 'okunamadı' }));
  return r;
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
          const r = await fetchWithLog(`${backendUrl}/health`, { method: 'GET' });
          const data = await r.json().catch(() => ({}));
          return toResponse(data || { ok: true, status: 'ok' });
        }
        const res = await callFn<{ status?: string }>('health', {}, null);
        return toResponse(res || { status: 'ok' });
      }
      // Tek otorite: Backend JWT. Edge /me çağrılmaz (401 biter).
      if (pathname === '/auth/me' || pathname === 'auth/me') {
        const backendUrl = getBackendUrl();
        if (!backendUrl) {
          const err = new Error('Sunucu adresi tanımlı değil') as Error & { response?: { status: number; data: unknown } };
          err.response = { status: 503, data: { message: 'EXPO_PUBLIC_BACKEND_URL tanımlayın.' } };
          throw err;
        }
        if (!token) {
          const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
          err.response = { status: 401, data: { message: 'Token bulunamadı' } };
          throw err;
        }
        const timeoutMs = _config?.timeout ?? 15000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let r: Response;
        try {
          r = await fetchWithLog(`${backendUrl}/api/auth/me`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
        const data = await r.json().catch(() => ({})) as Record<string, unknown>;
        throwIfNotOk(r, data, 'Bilgi alınamadı');
        return toResponse(data);
      }
      if (pathname === '/auth/profile' || pathname === 'auth/profile') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) {
          const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
          err.response = { status: 401, data: { message: 'Token bulunamadı' } };
          throw err;
        }
        const r = await fetchWithLog(`${backendUrl}/api/auth/profile`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({})) as Record<string, unknown>;
        throwIfNotOk(r, data, 'Profil alınamadı');
        return toResponse(data);
      }
      if (pathname === '/tesis' || pathname === 'tesis') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          if (!token) {
            const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
            err.response = { status: 401, data: { message: 'Token bulunamadı' } };
            throw err;
          }
          const r = await fetchWithLog(`${backendUrl}/api/tesis`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await r.json().catch(() => ({})) as Record<string, unknown>;
          throwIfNotOk(r, data, 'Tesis alınamadı');
          return toResponse(data as { tesis: unknown; ozet: unknown });
        }
        const res = await callFn('facilities_list', {}, token);
        return toResponse(res as { tesis: unknown; ozet: unknown });
      }
      if (pathname.startsWith('/tesis/kbs') || pathname === 'tesis/kbs') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          if (!token) {
            const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
            err.response = { status: 401, data: { message: 'Token bulunamadı' } };
            throw err;
          }
          const r = await fetchWithLog(`${backendUrl}/api/tesis/kbs`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await r.json().catch(() => ({})) as Record<string, unknown>;
          throwIfNotOk(r, data, 'Yetkisiz');
          return toResponse(data);
        }
        const res = await callFn('settings_get', {}, token);
        return toResponse(res);
      }
      if (pathname === '/kbs/credentials/status' || pathname === 'kbs/credentials/status') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const qs = query && Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
        const r = await fetchWithLog(`${backendUrl}/api/kbs/credentials/status${qs}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({})) as Record<string, unknown>;
        throwIfNotOk(r, data, 'Durum alınamadı');
        return toResponse(data);
      }
      if (pathname === '/okutulan-belgeler' || pathname === 'okutulan-belgeler') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const qs = query && Object.keys(query).length ? '?' + new URLSearchParams(query as Record<string, string>).toString() : '';
        const r = await fetchWithLog(`${backendUrl}/api/okutulan-belgeler${qs}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({}));
        if (r.status === 404) return toResponse({ items: [], nextCursor: null });
        throwIfNotOk(r, data as Record<string, unknown>, 'Liste alınamadı');
        return toResponse(data);
      }
      if (pathname === '/oda' || pathname === 'oda') {
        const filtre = query.filtre || 'tumu';
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          if (!token) {
            const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
            err.response = { status: 401, data: { message: 'Token bulunamadı' } };
            throw err;
          }
          const r = await fetchWithLog(`${backendUrl}/api/oda?filtre=${encodeURIComponent(filtre)}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
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
          if (!token) {
            const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
            err.response = { status: 401, data: { message: 'Token bulunamadı' } };
            throw err;
          }
          const r = await fetchWithLog(`${backendUrl}/api/oda/${odaMatch[1]}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Oda alınamadı'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('room_get', { id: odaMatch[1] }, token);
        return toResponse(res);
      }
      if (pathname === '/rapor' || pathname === 'rapor') {
        const backendUrl = getBackendUrl();
        if (!backendUrl) {
          const err = new Error('Sunucu adresi tanımlı değil') as Error & { response?: { status: number; data: unknown } };
          err.response = { status: 503, data: { message: 'EXPO_PUBLIC_BACKEND_URL tanımlayın.' } };
          throw err;
        }
        if (!token) {
          const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
          err.response = { status: 401, data: { message: 'Token bulunamadı' } };
          throw err;
        }
        const r = await fetchWithLog(`${backendUrl}/api/rapor`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Rapor alınamadı'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      logger.warn('[apiSupabase] Unmapped GET', path);
      const res = await callFn('facilities_list', {}, token);
      return toResponse(res);
    } catch (e) {
      await wrapError(e);
    }
  },

  async post(path: string, body?: Record<string, unknown> | FormData, _config?: { headers?: Record<string, string>; timeout?: number; token?: string | null }) {
    const pathname = path.replace(/\?.*$/, '');
    const token = _config?.token !== undefined ? _config.token : await getToken();
    const payload: Record<string, unknown> = body && !(body instanceof FormData) ? body as Record<string, unknown> : {};

    try {
      if (pathname === '/auth/giris' || pathname === 'auth/giris') {
        const backendUrl = getBackendUrl();
        if (backendUrl && (payload.tesisKodu || payload.pin)) {
          const r = await fetchWithLog(`${backendUrl}/api/auth/giris`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Giriş başarısız'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('auth_login', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/aktivasyon' || pathname === 'auth/aktivasyon') {
        const backendUrl = getBackendUrl();
        if (backendUrl && payload.tesisKodu) {
          const r = await fetchWithLog(`${backendUrl}/api/auth/aktivasyon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Aktivasyon başarısız'), { response: { status: r.status, data } });
          return toResponse(data);
        }
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
        const r = await fetchWithLog(`${backendUrl}/api/auth/sifre-sifirla/otp-iste`, {
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
        const r = await fetchWithLog(`${backendUrl}/api/auth/sifre-sifirla`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Şifre güncellenemedi'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/giris/yeni' || pathname === 'auth/giris/yeni') {
        // Telefon/e-posta + şifre girişi sadece backend üzerinden; Edge OTP içindir.
        const backendUrl = getBackendUrl();
        if ((payload.telefon || payload.email) && payload.sifre) {
          if (!backendUrl) throw new Error('Sunucu adresi eksik. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
          const r = await fetchWithLog(`${backendUrl}/api/auth/giris/yeni`, {
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
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetchWithLog(`${backendUrl}/api/auth/giris/otp-iste`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'SMS gönderilemedi'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('auth_request_otp', payload, { requireAuth: false });
        return toResponse(res);
      }
      if (pathname === '/auth/giris/otp-dogrula' || pathname === 'auth/giris/otp-dogrula') {
        const backendUrl = getBackendUrl();
        const p = payload as { access_token?: string; telefon?: string; otp?: string };
        const hasAccessToken = !!p?.access_token;
        const hasTelefonOtp = !!p?.telefon && !!p?.otp;
        if (backendUrl && (hasAccessToken || hasTelefonOtp)) {
          const r = await fetchWithLog(`${backendUrl}/api/auth/giris/otp-dogrula`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (r.ok) return toResponse(data);
          throw Object.assign(new Error((data as { message?: string })?.message || 'Doğrulama başarısız'), {
            response: { status: r.status, data },
          });
        }
        const res = await callFn('auth_verify_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/supabase-phone-session' || pathname === 'auth/supabase-phone-session') {
        const res = await callFn('auth_supabase_phone_session', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/kayit' || pathname === 'auth/kayit') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetchWithLog(`${backendUrl}/api/auth/kayit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string }).message || 'Kayıt başarısız'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn('auth_request_otp', payload, null);
        return toResponse(res);
      }
      if (pathname === '/auth/kayit/otp-iste' || pathname === 'auth/kayit/otp-iste') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          const r = await fetchWithLog(`${backendUrl}/api/auth/kayit/otp-iste`, {
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
          const r = await fetchWithLog(`${backendUrl}/api/auth/kayit/dogrula`, {
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
        const r = await fetchWithLog(`${backendUrl}/api/auth/kayit/supabase-verify-otp`, {
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
        const r = await fetchWithLog(`${backendUrl}/api/auth/kayit/supabase-create`, {
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
      if (pathname === '/auth/privacy-accept' || pathname === 'auth/privacy-accept') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/auth/privacy-accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload || {}),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Onay kaydedilemedi'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/terms-accept' || pathname === 'auth/terms-accept') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/auth/terms-accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload || {}),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Onay kaydedilemedi'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/auth/restore-account' || pathname === 'auth/restore-account') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/auth/restore-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload || {}),
        });
        const data = await r.json().catch(() => ({})) as Record<string, unknown>;
        throwIfNotOk(r, data, 'İşlem yapılamadı');
        return toResponse(data);
      }
      if (pathname === '/auth/request-account-deletion' || pathname === 'auth/request-account-deletion') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/auth/request-account-deletion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload || {}),
        });
        const data = await r.json().catch(() => ({})) as Record<string, unknown>;
        throwIfNotOk(r, data, 'İşlem yapılamadı');
        return toResponse(data);
      }
      if (pathname === '/nfc/okut' || pathname === 'nfc/okut') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetchWithLog(`${backendUrl}/api/nfc/okut`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'NFC okunamadı'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data as { success: boolean; parsed?: Record<string, unknown> });
        }
        const res = await callFn('nfc_read', payload, token);
        return toResponse(res);
      }
      if (pathname === '/ocr/mrz' || pathname === 'ocr/mrz') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token && body instanceof FormData) {
          const r = await fetchWithLog(`${backendUrl}/api/ocr/mrz`, {
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
      if (pathname === '/ocr/document' || pathname === 'ocr/document') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token && body instanceof FormData) {
          const r = await fetchWithLog(`${backendUrl}/api/ocr/document`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: body as FormData,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'Belge okunamadı'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data as DocumentScanResponse);
        }
        throw new Error('Belge okuma için sunucu adresi ve giriş gerekli.');
      }
      if (pathname === '/ocr/document-base64' || pathname === 'ocr/document-base64') {
        const backendUrl = getBackendUrl();
        const payload = body as { imageBase64?: string };
        if (backendUrl && token && payload && typeof payload.imageBase64 === 'string') {
          const r = await fetchWithLog(`${backendUrl}/api/ocr/document-base64`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ imageBase64: payload.imageBase64 }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'Belge okunamadı'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data as DocumentScanResponse);
        }
        throw new Error('Belge okuma için sunucu adresi ve giriş gerekli.');
      }
      if (pathname === '/ocr/document-front-back' || pathname === 'ocr/document-front-back') {
        const backendUrl = getBackendUrl();
        const payload = body as { frontBase64?: string; backBase64?: string };
        if (backendUrl && token && payload && typeof payload.frontBase64 === 'string' && typeof payload.backBase64 === 'string') {
          const r = await fetchWithLog(`${backendUrl}/api/ocr/document-front-back`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ frontBase64: payload.frontBase64, backBase64: payload.backBase64 }),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'Belge okunamadı'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data as DocumentScanResponse);
        }
        throw new Error('Belge okuma için sunucu adresi, giriş ve ön/arka görsel gerekli.');
      }
      if (pathname === '/okutulan-belgeler' || pathname === 'okutulan-belgeler') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/okutulan-belgeler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body || {}),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Kayıt başarısız'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/ocr/documents-batch' || pathname === 'ocr/documents-batch') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token && body instanceof FormData) {
          const r = await fetchWithLog(`${backendUrl}/api/ocr/documents-batch`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: body as FormData,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'Toplu okuma başarısız'), {
              response: { status: r.status, data },
            });
          }
          return toResponse(data as { success: boolean; results: DocumentBatchItem[] });
        }
        throw new Error('Toplu belge okuma için sunucu adresi ve giriş gerekli.');
      }
      if (pathname === '/ocr/okut' || pathname === 'ocr/okut') {
        if (body instanceof FormData) {
          const imagePart = body.get('image') as { uri?: string } | null;
          const uri = imagePart?.uri;
          if (uri) {
            try {
              const FileSystem = require('expo-file-system/legacy').default;
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
          const r = await fetchWithLog(`${backendUrl}/api/misafir/checkin`, {
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
          const msg = (data as { message?: string })?.message || 'Check-in kaydedildi';
          return toResponse({ success: true, message: msg, misafir: (data as { misafir?: unknown })?.misafir, guestId: (data as { guestId?: string })?.guestId });
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
        if (!backendUrl) {
          throw Object.assign(new Error('KBS testi için backend adresi gerekli. EXPO_PUBLIC_BACKEND_URL tanımlayın.'), {
            response: { status: 503, data: { message: 'EXPO_PUBLIC_BACKEND_URL tanımlı değil.' } },
          });
        }
        if (!token) {
          throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: { message: 'Token yok' } } });
        }
        const body = (payload && typeof payload === 'object' && !Array.isArray(payload))
          ? { kbsTuru: (payload as { kbsTuru?: string })?.kbsTuru, kbsTesisKodu: (payload as { kbsTesisKodu?: string })?.kbsTesisKodu, kbsWebServisSifre: (payload as { kbsWebServisSifre?: string })?.kbsWebServisSifre }
          : {};
        const r = await fetchWithLog(`${backendUrl}/api/tesis/kbs/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw Object.assign(new Error((data as { message?: string })?.message || 'KBS test başarısız'), {
            response: { status: r.status, data },
          });
        }
        return toResponse(data);
      }
      if (pathname === '/tesis/kbs/talebi' || pathname === 'tesis/kbs/talebi') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetchWithLog(`${backendUrl}/api/tesis/kbs/talebi`, {
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
      if (pathname === '/tesis/kbs/import' || pathname === 'tesis/kbs/import') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetchWithLog(`${backendUrl}/api/tesis/kbs/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload || {}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw Object.assign(new Error((data as { message?: string })?.message || 'KBS aktarımı başarısız'), { response: { status: r.status, data } });
          }
          return toResponse(data);
        }
        throw new Error('Sunucu adresi tanımlı değil');
      }
      // KBS tesis bilgisi talep (create/update/delete) — admin onayına gider
      if (pathname === '/kbs/credentials/request' || pathname === 'kbs/credentials/request') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/kbs/credentials/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload || {}),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Talep gönderilemedi'), { response: { status: r.status, data } });
        return toResponse(data);
      }
      if (pathname === '/notification_submit' || pathname === 'notification_submit') {
        const res = await callFn('notification_submit', payload, token);
        return toResponse(res);
      }
      if (pathname === '/oda' || pathname === 'oda') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetchWithLog(`${backendUrl}/api/oda`, {
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
        if (!token) {
          throw Object.assign(new Error('Giriş gerekli. Oda eklemek için lütfen tekrar giriş yapın.'), { response: { status: 401, data: { message: 'Giriş gerekli' } } });
        }
        throw new Error('Sunucu adresi tanımlı değil. EXPO_PUBLIC_BACKEND_URL tanımlayın.');
      }
      const checkoutMatch = pathname.match(/^\/?misafir\/checkout\/([^/]+)$/);
      if (checkoutMatch) {
        const guestId = checkoutMatch[1];
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetchWithLog(`${backendUrl}/api/checkout/${guestId}`, {
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
      // Paket siparişi (Satın Al) — backend JWT ile tesis bilgisi gerekir
      if (pathname === '/siparis' || pathname === 'siparis') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/siparis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload || {}),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Sipariş oluşturulamadı'), { response: { status: r.status, data } });
        return toResponse(data);
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
      if (pathname === '/tesis/bilgi' || pathname === 'tesis/bilgi') {
        const backendUrl = getBackendUrl();
        if (backendUrl && token) {
          const r = await fetchWithLog(`${backendUrl}/api/tesis/bilgi`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(body || {}),
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Tesis adı güncellenemedi'), { response: { status: r.status, data } });
          return toResponse(data);
        }
        const res = await callFn<{ tesis: { id: string; tesisAdi: string } }>('branch_update', (body || {}) as Record<string, unknown>, token);
        return toResponse(res);
      }
      if (pathname === '/auth/profile' || pathname === 'auth/profile') {
        const backendUrl = getBackendUrl();
        if (!backendUrl || !token) throw Object.assign(new Error('Giriş gerekli'), { response: { status: 401, data: {} } });
        const r = await fetchWithLog(`${backendUrl}/api/auth/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body || {}),
        });
        const data = await r.json().catch(() => ({})) as Record<string, unknown>;
        throwIfNotOk(r, data, 'Profil güncellenemedi');
        return toResponse(data);
      }
      if (pathname === '/tesis/kbs' || pathname === 'tesis/kbs') {
        const backendUrl = getBackendUrl();
        if (backendUrl) {
          if (!token) {
            const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
            err.response = { status: 401, data: { message: 'Token bulunamadı' } };
            throw err;
          }
          const r = await fetchWithLog(`${backendUrl}/api/tesis/kbs`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
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
    const odaDeleteMatch = path.match(/^\/?oda\/([^/]+)$/);
    if (odaDeleteMatch) {
      const backendUrl = getBackendUrl();
      if (!backendUrl) {
        const err = new Error('Sunucu adresi tanımlı değil') as Error & { response?: { status: number; data: unknown } };
        err.response = { status: 503, data: { message: 'EXPO_PUBLIC_BACKEND_URL tanımlayın.' } };
        throw err;
      }
      if (!token) {
        const err = new Error('Giriş gerekli') as Error & { response?: { status: number; data: unknown } };
        err.response = { status: 401, data: { message: 'Token bulunamadı' } };
        throw err;
      }
      const r = await fetchWithLog(`${backendUrl}/api/oda/${odaDeleteMatch[1]}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error((data as { message?: string })?.message || 'Oda silinemedi'), { response: { status: r.status, data } });
      return toResponse(data);
    }
    logger.warn('[apiSupabase] Unmapped DELETE', path);
    return toResponse({});
  },
};
