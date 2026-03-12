import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setApiTokenProvider, setOnUnauthorized } from '../services/api';
import { dataService, setDataServiceTokenProvider } from '../services/dataService';
import { logger } from '../utils/logger';
import { getIsAdminPanelUser } from '../utils/adminAuth';
import { supabase, refreshSessionWithRetry } from '../lib/supabase/supabase';

const APP_PREFIX = 'mykbs';

const AUTH_STORAGE_KEYS = {
  TOKEN: `@${APP_PREFIX}:auth:token`,
  USER: `@${APP_PREFIX}:auth:user`,
  TESIS: `@${APP_PREFIX}:auth:tesis`,
  SUPABASE_TOKEN: `@${APP_PREFIX}:auth:supabase_token`,
  LAST_TAB: `@${APP_PREFIX}:auth:last_tab`,
  RECOVERY_PENDING: `@${APP_PREFIX}:auth:recovery_pending`,
  /** Cihaz başına tek misafir hesabı: { email, password } — çıkışta silinmez, tekrar girişte aynı hesap kullanılır */
  GUEST_CREDENTIALS: `@${APP_PREFIX}:auth:guest_credentials`,
  LOCAL_PRIVACY_ACCEPTED_AT: `@${APP_PREFIX}:consent:local_privacy_at`,
  LOCAL_TERMS_ACCEPTED_AT: `@${APP_PREFIX}:consent:local_terms_at`,
};

const AuthContext = createContext({});

/**
 * Kullanıcıya gösterilecek auth hata mesajı üretir (timeout, 503, network, 500).
 */
function getAuthErrorMessage(e) {
  if (!e) return 'Bilgi alınamadı.';
  if (e?.name === 'AbortError') return 'Sunucu yanıt vermiyor (zaman aşımı).';
  const status = e?.response?.status;
  const msg = e?.response?.data?.message || e?.message || '';
  if (status === 503 || msg.includes('Sunucu adresi') || msg.includes('tanımlı değil')) return 'Sunucu adresi tanımlı değil veya geçici olarak kapalı.';
  if (status === 401) return 'Oturum süresi dolmuş, tekrar giriş yapın.';
  if (!e?.response) return 'Backend\'e ulaşılamıyor. İnterneti kontrol edin.';
  return msg || 'Bilgi alınamadı.';
}

/**
 * Token ile /auth/me çağırıp user/tesis state'ini günceller.
 * @param setAuthError - opsiyonel; hata durumunda kullanıcı mesajı set edilir, başarıda null.
 * @returns {Promise<boolean>} true = kullanıcı/tesis set edildi veya zaten token geçerli; false = 401 ile oturum temizlendi (giriş başarısız).
 */
const ME_429_BACKOFF_MS = 60000; // 429 alındıktan sonra bu süre boyunca /auth/me atlanır, cache kullanılır

async function fetchMeAndSetState(accessToken, setUser, setTesis, setToken, getTokenProvider, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, setAuthError, options) {
  if (!accessToken) return false;
  if (typeof setAuthError === 'function') setAuthError(null);
  const last429Ref = options?.last429Ref;
  const backoffMs = options?.backoffMs ?? ME_429_BACKOFF_MS;
  if (last429Ref?.current && (Date.now() - last429Ref.current) < backoffMs) {
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, accessToken);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, accessToken);
      setToken(accessToken);
      const getToken = getTokenProvider ? getTokenProvider() : (async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN));
      setApiTokenProvider(getToken);
      setDataServiceTokenProvider(getToken);
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
      const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
      }
      if (storedTesis) setTesis(JSON.parse(storedTesis));
      logger.warn('AuthContext fetch /me: 429 backoff, using cache');
    } catch (_) {}
    return true;
  }
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, accessToken);
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, accessToken);
  setToken(accessToken);
  const getToken = getTokenProvider ? getTokenProvider() : (async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN));
  setApiTokenProvider(getToken);
  setDataServiceTokenProvider(getToken);
  try {
    const res = await api.get('/auth/me', { timeout: 10000 });
    const { kullanici, tesis: tesisData, privacyPolicyAcceptedAt, termsOfServiceAcceptedAt, accountPendingDeletion, deletionAt } = res.data || {};
    if (kullanici) {
      const userWithAdmin = { ...kullanici, isAdmin: getIsAdminPanelUser(kullanici) };
      setUser(userWithAdmin);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userWithAdmin));
    }
    if (tesisData) {
      setTesis(tesisData);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(tesisData));
    }
    if (setPrivacyPolicyAcceptedAt != null && privacyPolicyAcceptedAt != null) {
      setPrivacyPolicyAcceptedAt(privacyPolicyAcceptedAt);
    }
    if (setTermsOfServiceAcceptedAt != null && termsOfServiceAcceptedAt != null) {
      setTermsOfServiceAcceptedAt(termsOfServiceAcceptedAt);
    }
    if (typeof setAccountPendingDeletion === 'function') {
      setAccountPendingDeletion(!!accountPendingDeletion);
    }
    if (typeof setDeletionAt === 'function' && deletionAt) {
      setDeletionAt(deletionAt);
    }
    if (typeof setGuest === 'function' && res.data?.isGuest != null) {
      setGuest(!!res.data.isGuest);
    }
    if (typeof setAuthError === 'function') setAuthError(null);
    return true;
  } catch (e) {
    const status = e?.response?.status;
    const code = e?.response?.data?.code;
    const serverMessage = e?.response?.data?.message || '';
    // 401: Oturum süresi dolmuş olabilir. API katmanı onUnauthorized (handle401OrLogout) tetikler;
    // o önce token yenilemeyi dener, başarılı olursa profil geri gelir. Burada oturumu silme,
    // yoksa "hesaptayken profil kayboluyor" olur (hem yenileme hem silme aynı anda çalışıyordu).
    if (status === 401) {
      logger.warn('AuthContext fetch /me: 401 – token yenileme onUnauthorized üzerinden denenecek');
      return false;
    }
    if (status === 404 || (status === 500 && code === 'GUEST_SETUP_FAILED')) {
      if (status === 404) {
        logger.warn('AuthContext fetch /me: kullanıcı bulunamadı (404), oturum temizleniyor');
      }
      if (code === 'ACCOUNT_DELETED' && typeof setAuthError === 'function') {
        setAuthError(serverMessage || 'Hesabınız silindi. Destek talebiniz oluşturuldu; yönetici inceleyecektir.');
      }
      try {
        await supabase?.auth?.signOut();
      } catch (_) {}
      await AsyncStorage.multiRemove([AUTH_STORAGE_KEYS.TOKEN, AUTH_STORAGE_KEYS.SUPABASE_TOKEN, AUTH_STORAGE_KEYS.USER, AUTH_STORAGE_KEYS.TESIS]);
      setToken(null);
      setUser(null);
      setTesis(null);
      if (code !== 'ACCOUNT_DELETED' && typeof setAuthError === 'function') setAuthError(null);
      return false;
    }
    if (status === 409 && (code === 'BRANCH_NOT_ASSIGNED' || code === 'BRANCH_LOAD_FAILED')) {
      try {
        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
        const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
        }
        if (storedTesis) {
          setTesis(JSON.parse(storedTesis));
        }
        logger.warn('AuthContext fetch /me branch not assigned; using cached auth state');
      } catch (storageErr) {
        logger.error('AuthContext branch-not-assigned cache restore failed', storageErr);
      }
      if (typeof setAuthError === 'function') setAuthError(null);
      return true;
    }
    if (status === 429) {
      if (options?.last429Ref) options.last429Ref.current = Date.now();
      try {
        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
        const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
        }
        if (storedTesis) setTesis(JSON.parse(storedTesis));
        logger.warn('AuthContext fetch /me: 429 rate limit, using cached auth state');
      } catch (_) {}
      if (typeof setAuthError === 'function') setAuthError('Çok fazla istek. Lütfen 1–2 dakika sonra tekrar deneyin.');
      return true;
    }
    if (status === 500) {
      try {
        const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
        const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
        }
        if (storedTesis) setTesis(JSON.parse(storedTesis));
        logger.warn('AuthContext fetch /me: 500, using cached auth state');
      } catch (_) {}
      if (typeof setAuthError === 'function') setAuthError('Bilgi alınamadı. Önbellekten devam ediliyor; kısa süre sonra tekrar deneyin.');
      return true;
    }
    const userMessage = getAuthErrorMessage(e);
    if (typeof setAuthError === 'function') setAuthError(userMessage);
    logger.error('AuthContext fetch /me failed', e);
    return true; // Diğer hatalarda token'ı tutuyoruz, kullanıcı sonra tekrar dener
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tesis, setTesis] = useState(null);
  const [token, setToken] = useState(null);
  const [lastTab, setLastTabState] = useState(null);
  const [privacyPolicyAcceptedAt, setPrivacyPolicyAcceptedAt] = useState(null);
  const [termsOfServiceAcceptedAt, setTermsOfServiceAcceptedAt] = useState(null);
  const [localPrivacyAcceptedAt, setLocalPrivacyAcceptedAt] = useState(null);
  const [localTermsAcceptedAt, setLocalTermsAcceptedAt] = useState(null);
  const [accountPendingDeletion, setAccountPendingDeletion] = useState(false);
  const [deletionAt, setDeletionAt] = useState(null);
  const [isGuest, setGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recoverySessionPending, setRecoverySessionPending] = useState(false);
  const [authError, setAuthError] = useState(null);
  const mounted = useRef(true);
  const lastMe429AtRef = useRef(0);
  const lastFetchMeAtRef = useRef(0);
  const getSupabaseAwareTokenProviderRef = useRef(null);
  const ME_REFRESH_THROTTLE_MS = 45000; // TOKEN_REFRESHED / focus'tan en fazla 45 sn'de bir /auth/me
  const me429Options = { last429Ref: lastMe429AtRef, backoffMs: ME_429_BACKOFF_MS };

  /** Supabase kullanılıyorsa her istekte güncel session'dan token alır; süresi dolmuşsa refresh eder. Böylece "Geçersiz token" 401 önlenir. getSession hata verirse veya session boşsa AsyncStorage'dan dön (oturum açıkken token null görünmesin). */
  const getSupabaseAwareTokenProvider = () => {
    return async () => {
      try {
        if (supabase?.auth) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const expiresAt = session.expires_at;
            const nowSec = Math.floor(Date.now() / 1000);
            const bufferSec = 5 * 60;
            if (!expiresAt || expiresAt > nowSec + bufferSec) {
              return session.access_token;
            }
            const { data: { session: refreshed }, error } = await refreshSessionWithRetry();
            if (!error && refreshed?.access_token) {
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, refreshed.access_token);
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, refreshed.access_token);
              setToken(refreshed.access_token);
              return refreshed.access_token;
            }
            if (expiresAt && expiresAt <= nowSec + bufferSec) {
              return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN) || await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
            }
            return session.access_token;
          }
        }
      } catch (e) {
        logger.warn('getSupabaseAwareTokenProvider getSession/refresh failed, using storage', e?.message || e);
      }
      return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN) || await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
    };
  };
  getSupabaseAwareTokenProviderRef.current = getSupabaseAwareTokenProvider;

  const isAuthenticated = !!token && !!user;

  const hasPrivacyAccepted = !!(privacyPolicyAcceptedAt || localPrivacyAcceptedAt);
  const hasTermsAccepted = !!(termsOfServiceAcceptedAt || localTermsAcceptedAt);
  const needsPrivacyConsent = !hasPrivacyAccepted;
  const needsTermsConsent = hasPrivacyAccepted && !hasTermsAccepted;

  const clearAuth = async () => {
    // Önce state temizle ki ekran hemen girişe dönsün (tek tıkla çıkış)
    setToken(null);
    setUser(null);
    setTesis(null);
    setLastTabState(null);
    setPrivacyPolicyAcceptedAt(null);
    setTermsOfServiceAcceptedAt(null);
    setAccountPendingDeletion(false);
    setDeletionAt(null);
    setGuest(false);
    setAuthError(null);
    setApiTokenProvider(null);
    setDataServiceTokenProvider(null);
    // Storage ve cache arka planda temizlensin (çıkışı yavaşlatmasın)
    Promise.all([
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TESIS),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN),
      AsyncStorage.removeItem(AUTH_STORAGE_KEYS.LAST_TAB),
    ]).catch(() => {});
    dataService.clearCache().catch((e) => logger.error('Cache clear on logout error', e));
  };

  useEffect(() => {
    mounted.current = true;
    let sub;
    const LOAD_TIMEOUT_MS = 10000; // Takılırsa 10 sn sonra ana sayfa açılsın
    let timeoutId;

    // Token sağlayıcıyı hemen ayarla: init tamamlanmadan yapılan api.get('/oda') vb. istekler
    // AsyncStorage'daki token ile gider; backend 401 "Token bulunamadı" almaz.
    setApiTokenProvider(() => AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN));
    setDataServiceTokenProvider(() => AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN));

    async function init() {
      setAuthError(null);
      try {
        const storedLastTab = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.LAST_TAB);
        if (storedLastTab) setLastTabState(storedLastTab);
        const localPrivacy = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.LOCAL_PRIVACY_ACCEPTED_AT);
        const localTerms = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.LOCAL_TERMS_ACCEPTED_AT);
        if (localPrivacy && mounted.current) setLocalPrivacyAcceptedAt(localPrivacy);
        if (localTerms && mounted.current) setLocalTermsAcceptedAt(localTerms);

        if (supabase) {
          const { data: { session: refreshedSession }, error: refreshError } = await refreshSessionWithRetry();
          const session = !refreshError && refreshedSession?.access_token
            ? refreshedSession
            : (await supabase.auth.getSession()).data?.session;
          if (session?.access_token && mounted.current) {
            const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
            const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
            if (storedUser && mounted.current) {
              const parsed = JSON.parse(storedUser);
              setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
            }
            if (storedTesis && mounted.current) setTesis(JSON.parse(storedTesis));
            await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, session.access_token);
            await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, session.access_token);
            setToken(session.access_token);
            const getToken = getSupabaseAwareTokenProvider ? getSupabaseAwareTokenProvider() : (async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN));
            setApiTokenProvider(getToken);
            setDataServiceTokenProvider(getToken);
            // Cache'li oturum varsa ana ekranı hemen aç; /auth/me arka planda doğrulasın (uygulama geç açılmasın)
            if (storedUser && storedTesis) {
              setIsLoading(false);
              fetchMeAndSetState(session.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, setAuthError, me429Options).catch(() => {});
            } else {
              await fetchMeAndSetState(session.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, setAuthError, me429Options);
            }
          } else {
            // Supabase oturumu yok: backend JWT (telefon+şifre girişi) ile kayıtlı token varsa doğrula
            const storedToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
            const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
            const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
            if (storedToken && storedUser && mounted.current) {
              setToken(storedToken);
              const parsed = JSON.parse(storedUser);
              setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
              setTesis(storedTesis ? JSON.parse(storedTesis) : null);
              const getToken = async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
              setApiTokenProvider(getToken);
              setDataServiceTokenProvider(() => getToken());
              try {
                const res = await api.get('/auth/me');
                if (res?.data && mounted.current) {
                  const k = res.data.kullanici ?? res.data.user;
                  setUser(k ? { ...k, isAdmin: getIsAdminPanelUser(k) } : null);
                  setTesis(res.data.tesis ?? res.data.tesisData ?? null);
                  if (res.data.privacyPolicyAcceptedAt != null) setPrivacyPolicyAcceptedAt(res.data.privacyPolicyAcceptedAt);
                  if (res.data.termsOfServiceAcceptedAt != null) setTermsOfServiceAcceptedAt(res.data.termsOfServiceAcceptedAt);
                  if (res.data.accountPendingDeletion) setAccountPendingDeletion(true);
                  if (res.data.deletionAt) setDeletionAt(res.data.deletionAt);
                  if (res.data?.isGuest != null) setGuest(!!res.data.isGuest);
                  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(res.data.kullanici ?? res.data.user));
                  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(res.data.tesis ?? res.data.tesisData ?? null));
                }
              } catch (e) {
                if (e?.response?.status === 401 && mounted.current) {
                  await clearAuth();
                } else if (mounted.current && typeof setAuthError === 'function') {
                  setAuthError(getAuthErrorMessage(e));
                }
              }
            }
          }
          sub = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted.current) return;
            if (event === 'SIGNED_OUT') {
              await clearAuth();
            } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.access_token) {
              const recoveryPending = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.RECOVERY_PENDING);
              if (recoveryPending === '1') {
                await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.RECOVERY_PENDING);
                setRecoverySessionPending(true);
                return;
              }
              if (event === 'TOKEN_REFRESHED') {
                const now = Date.now();
                if (now - lastFetchMeAtRef.current < ME_REFRESH_THROTTLE_MS) return;
                lastFetchMeAtRef.current = now;
              }
              await fetchMeAndSetState(session.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, undefined, me429Options);
            }
          });
        } else {
          const storedToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
          const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
          const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
          if (storedToken && storedUser) {
            setToken(storedToken);
            const parsed = JSON.parse(storedUser);
            setUser({ ...parsed, isAdmin: getIsAdminPanelUser(parsed) });
            setTesis(storedTesis ? JSON.parse(storedTesis) : null);
            const getToken = async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
            setApiTokenProvider(getToken);
            setDataServiceTokenProvider(() => getToken());
          }
        }
      } catch (error) {
        logger.error('Auth init error', error);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (mounted.current) setIsLoading(false);
      }
    }

    timeoutId = setTimeout(() => {
      if (mounted.current) {
        setIsLoading(false);
        logger.warn('Auth init timeout – loading ended so app can open');
      }
    }, LOAD_TIMEOUT_MS);

    init();
    return () => {
      mounted.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (sub?.unsubscribe) sub.unsubscribe();
    };
  }, []);

  // Uygulama ön plana geldiğinde sessizce token yenile (arka plandan dönünce 401 önlenir)
  useEffect(() => {
    if (!supabase) return;
    const refreshTokenSilently = async () => {
      try {
        const { data: { session: refreshed }, error } = await refreshSessionWithRetry();
        if (!mounted.current || error || !refreshed?.access_token) return;
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, refreshed.access_token);
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, refreshed.access_token);
        setToken(refreshed.access_token);
        setApiTokenProvider(() => Promise.resolve(refreshed.access_token));
        setDataServiceTokenProvider(() => Promise.resolve(refreshed.access_token));
        const now = Date.now();
        if (now - lastFetchMeAtRef.current >= ME_REFRESH_THROTTLE_MS) {
          lastFetchMeAtRef.current = now;
          fetchMeAndSetState(refreshed.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, undefined, me429Options).catch(() => {});
        }
      } catch (_) {}
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshTokenSilently();
    });
    return () => subscription?.remove?.();
  }, []);

  // Önce canlı Supabase oturumunu kullan; yoksa storage'daki SUPABASE_TOKEN (backend sadece Supabase token dönmüşse geçerli).
  // Edge me/upload_community_image vb. sadece Supabase Auth JWT ile çalışır; backend JWT 401 (INVALID_TOKEN) döner.
  const getSupabaseToken = async () => {
    if (supabase?.auth) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
    }
    return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
  };

  const refreshMe = useCallback(async () => {
    setAuthError(null);
    const now = Date.now();
    if (now - lastFetchMeAtRef.current < ME_REFRESH_THROTTLE_MS) return;
    lastFetchMeAtRef.current = now;
    const accessToken = await getSupabaseToken();
    if (accessToken) {
      await fetchMeAndSetState(accessToken, setUser, setTesis, setToken, supabase ? getSupabaseAwareTokenProvider : undefined, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, setAuthError, me429Options);
      return;
    }
    const backendToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
    if (backendToken) {
      try {
        const res = await api.get('/auth/me');
        if (res?.data && mounted.current) {
          const kullanici = res.data.kullanici ?? res.data.user;
          const tesisData = res.data.tesis ?? res.data.tesisData;
          const userWithAdmin = kullanici ? { ...kullanici, isAdmin: getIsAdminPanelUser(kullanici) } : null;
          setUser(userWithAdmin);
          setTesis(tesisData);
          if (userWithAdmin) await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userWithAdmin));
          if (tesisData) await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(tesisData));
        }
      } catch (_) {}
    }
  }, []);

  const setSupabaseToken = async (accessToken) => {
    if (accessToken) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, accessToken);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, accessToken);
      setToken(accessToken);
      const getToken = async () => accessToken;
      setApiTokenProvider(getToken);
      setDataServiceTokenProvider(() => getToken());
    }
  };

  const loginWithToken = async (tokenVal, kullanici, tesisData, supabaseAccessToken) => {
    // Backend iki token dönebilir: token (backend JWT) + supabaseAccessToken. API çağrıları backend JWT ile yapılmalı.
    // SUPABASE_TOKEN sadece gerçek Supabase Auth JWT ile set edilmeli; backend JWT Edge Function'larda 401 verir.
    const hasTwoTokens = tokenVal && supabaseAccessToken && tokenVal !== supabaseAccessToken;
    const tokenForApi = hasTwoTokens ? tokenVal : (supabaseAccessToken || tokenVal);
    if (!tokenForApi) {
      return { success: false, message: 'Oturum bilgisi alınamadı.' };
    }
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, tokenForApi);
      if (supabaseAccessToken) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, supabaseAccessToken);
      } else {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
      }
      setToken(tokenForApi);
      const getToken = async () => tokenForApi;
      setApiTokenProvider(getToken);
      setDataServiceTokenProvider(getToken);
      if (kullanici) {
        const userWithAdmin = { ...kullanici, isAdmin: getIsAdminPanelUser(kullanici) };
        setUser(userWithAdmin);
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(userWithAdmin));
      }
      if (tesisData) {
        setTesis(tesisData);
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(tesisData));
      }
      if (!kullanici || !tesisData) {
        const fetched = await fetchMeAndSetState(tokenForApi, setUser, setTesis, setToken, supabase ? getSupabaseAwareTokenProvider : undefined, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, setAuthError, me429Options);
        if (!fetched) {
          return { success: false, message: 'Bu hesap uygulamada tanımlı değil. Lütfen önce kayıt olun veya tesis kodunuzu kontrol edin.' };
        }
      }
      return { success: true };
    } catch (error) {
      logger.error('Login token save error', error);
      return { success: false, message: 'Giriş bilgileri kaydedilemedi' };
    }
  };

  const loginWithPassword = async (email, sifre) => {
    const emailNorm = (email || '').trim().toLowerCase();
    const passwordNorm = (sifre || '').trim();
    if (!emailNorm || !passwordNorm) {
      return { success: false, message: 'E-posta ve şifre giriniz.' };
    }
    try {
      const res = await api.post('/auth/giris/yeni', { email: emailNorm, sifre: passwordNorm });
      const { token: newToken, kullanici, tesis: tesisData, supabaseAccessToken: backendSupabaseToken } = res.data || {};
      if (newToken && kullanici && tesisData) {
        let supabaseAccessToken = backendSupabaseToken || null;
        if (!supabaseAccessToken && supabase?.auth) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: emailNorm,
              password: passwordNorm,
            });
            if (!error && data?.session?.access_token) {
              supabaseAccessToken = data.session.access_token;
            }
          } catch (e) {
            logger.warn('Supabase signInWithPassword atlanıyor', e?.message || e);
          }
        }
        return await loginWithToken(newToken, kullanici, tesisData, supabaseAccessToken);
      }
      return { success: false, message: res.data?.message || 'Giriş başarısız' };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message;
      const code = err?.response?.data?.code;
      logger.error('Login with password error', err);
      return { success: false, message: msg || 'Giriş başarısız', code };
    }
  };

  const loginWithPhoneAndPassword = async (telefon, sifre) => {
    try {
      const response = await api.post('/auth/giris/yeni', { telefon, sifre });
      const { token: newToken, kullanici, tesis: tesisData, supabaseAccessToken: backendSupabaseToken } = response.data || {};
      if (!newToken || !kullanici) {
        return { success: false, message: response.data?.message || 'Giriş başarısız' };
      }
      let supabaseAccessToken = backendSupabaseToken || null;
      const emailForSupabase = (kullanici.email || '').trim().toLowerCase();
      if (!supabaseAccessToken && supabase?.auth && emailForSupabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: emailForSupabase,
            password: sifre.trim(),
          });
          if (!error && data?.session?.access_token) {
            supabaseAccessToken = data.session.access_token;
          }
        } catch (e) {
          logger.warn('Supabase signInWithPassword atlanıyor', e?.message || e);
        }
      }
      return await loginWithToken(newToken, kullanici, tesisData, supabaseAccessToken);
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Giriş başarısız',
        code: error.response?.data?.code,
      };
    }
  };

  const resetPasswordForEmail = async (emailAddress) => {
    if (!supabase) {
      return { success: false, message: 'Şifre sıfırlama servisi kullanılamıyor.' };
    }
    try {
      // Şifre sıfırlama linki uygulamada açılsın (Supabase Redirect URLs: kbsprime://auth/callback)
      const redirectTo = 'kbsprime://auth/callback';
      const { error } = await supabase.auth.resetPasswordForEmail((emailAddress || '').trim().toLowerCase(), {
        redirectTo,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid') && msg.includes('credential')) {
          return { success: false, message: 'Bu e-posta adresi ile kayıtlı hesap bulunamadı. Kayıt olurken kullandığınız e-postayı girin.' };
        }
        return { success: false, message: error.message };
      }
      return { success: true, message: 'E-postanıza şifre sıfırlama linki gönderildi.' };
    } catch (error) {
      logger.error('resetPasswordForEmail error', error);
      return { success: false, message: error?.message || 'Link gönderilemedi.' };
    }
  };

  const login = async (tesisKodu, pin) => {
    try {
      const response = await api.post('/auth/giris', { tesisKodu, pin });
      const data = response.data || {};
      if (data.pendingApproval) {
        return { success: false, pendingApproval: true, message: data.message || 'Admin onayına sunuldu.' };
      }
      const { token: newToken, kullanici, tesis: tesisData } = data;
      if (!newToken || !kullanici) {
        return { success: false, message: data.message || 'Giriş başarısız' };
      }
      return await loginWithToken(newToken, kullanici, tesisData, null);
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Giriş başarısız',
      };
    }
  };

  const aktivasyon = async (tesisKodu, aktivasyonSifre) => {
    try {
      const response = await api.post('/auth/aktivasyon', { tesisKodu, aktivasyonSifre });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'Aktivasyon başarısız' };
    }
  };

  const setPin = async (pin, biyometriAktif) => {
    try {
      await api.post('/auth/pin', { pin, biyometriAktif });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.response?.data?.message || 'PIN kaydedilemedi' };
    }
  };

  const setLastTab = async (tabName) => {
    if (!tabName) return;
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.LAST_TAB, tabName);
      setLastTabState(tabName);
    } catch (e) {
      logger.error('lastTab save error', e);
    }
  };

  const loggingOutRef = useRef(false);
  const logout = async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      // Önce yerel state ve storage temizlensin; ekran hemen giriş sayfasına dönsün (tek tıkla çıkış)
      await clearAuth();
      // Supabase oturumunu arka planda kapat (yavaş olsa da UI zaten güncellendi)
      if (supabase) {
        supabase.auth.signOut().catch((e) => logger.error('Supabase signOut error', e));
      }
    } finally {
      loggingOutRef.current = false;
    }
  };

  /**
   * 401 alındığında önce token yenilemeyi dene; başarılı olursa profil bilgilerini geri yükle, çıkış yapma.
   * Böylece "hesabımda bir süre kalınca bilgiler kayboluyor" (token süresi dolunca tek istek 401 verip tüm state siliniyordu) önlenir.
   */
  const handle401OrLogout = useCallback(async () => {
    if (!mounted.current) return;
    if (supabase) {
      try {
        const { data: { session: refreshed }, error } = await refreshSessionWithRetry();
        if (!error && refreshed?.access_token && mounted.current) {
          const newToken = refreshed.access_token;
          await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, newToken);
          await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, newToken);
          setToken(newToken);
          const provider = () => Promise.resolve(newToken);
          setApiTokenProvider(provider);
          setDataServiceTokenProvider(provider);
          const getTokenProviderForMe = () => (async () => newToken);
          const ok = await fetchMeAndSetState(newToken, setUser, setTesis, setToken, getTokenProviderForMe, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, undefined, me429Options);
          if (ok && mounted.current) {
            const getProvider = getSupabaseAwareTokenProviderRef.current;
            if (getProvider) {
              setApiTokenProvider(getProvider());
              setDataServiceTokenProvider(getProvider());
            }
            logger.log('AuthContext: 401 sonrası token yenilendi, oturum korundu');
            return;
          }
        }
      } catch (e) {
        logger.warn('AuthContext: 401 sonrası token yenileme başarısız', e?.message || e);
      }
    }
    await logout();
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      handle401OrLogout();
    });
    return () => setOnUnauthorized(null);
  }, [handle401OrLogout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        tesis,
        setTesis,
        token,
        supabaseToken: token,
        lastTab,
        setLastTab,
        /** Tek kaynak: Giriş yapılmış mı? (token veya user varsa true – Instagram/TikTok tarzı sorunsuz kullanım) */
        isLoggedIn: !!(token || user),
        isAuthenticated: !!token && !!user,
        isLoading,
        authError,
        clearAuthError: () => setAuthError(null),
        recoverySessionPending,
        clearRecoveryPending: () => { setRecoverySessionPending(false); },
        login,
        loginWithPassword,
        loginWithPhoneAndPassword,
        loginWithToken,
        loginAsGuest: async () => {
          if (!supabase?.auth) return { success: false, message: 'Misafir girişi kullanılamıyor.' };
          try {
            let email = null;
            let password = null;
            const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.GUEST_CREDENTIALS);
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                if (parsed?.email && parsed?.password) {
                  email = parsed.email;
                  password = parsed.password;
                }
              } catch (_) {}
            }
            if (!email || !password) {
              const res = await api.post('/auth/guest/create');
              const data = res?.data;
              if (!data?.email || !data?.password) {
                return { success: false, message: 'Misafir hesabı oluşturulamadı.' };
              }
              email = data.email;
              password = data.password;
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.GUEST_CREDENTIALS, JSON.stringify({ email, password }));
            }
            const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
              if (error.message && (error.message.includes('Invalid') || error.message.includes('invalid'))) {
                await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.GUEST_CREDENTIALS);
                return { success: false, message: 'Kayıtlı misafir hesabı geçersiz. Tekrar deneyin.' };
              }
              return { success: false, message: error.message || 'Misafir girişi yapılamadı.' };
            }
            if (signInData?.session?.access_token && mounted.current) {
              await fetchMeAndSetState(signInData.session.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider, setPrivacyPolicyAcceptedAt, setTermsOfServiceAcceptedAt, setAccountPendingDeletion, setDeletionAt, setGuest, setAuthError, me429Options);
              return { success: true };
            }
            return { success: false, message: 'Oturum alınamadı.' };
          } catch (e) {
            logger.error('loginAsGuest error', e);
            return { success: false, message: e?.response?.data?.message || e?.message || 'Misafir girişi yapılamadı.' };
          }
        },
        resetPasswordForEmail,
        aktivasyon,
        setPin,
        logout,
        /** API istekleri için kullanılan token (backend JWT veya Supabase JWT). Giriş kontrolü için isLoggedIn kullanın. */
        getApiToken: () => token,
        getSupabaseToken,
        setSupabaseToken,
        refreshMe,
        setTesis,
        /** Gizlilik politikası onayı (ISO tarih string veya true). Yoksa lobide onay ekranı gösterilir. */
        privacyPolicyAcceptedAt,
        /** Yerel (giriş yapmadan) gizlilik onayı – sadece AsyncStorage. */
        localPrivacyAcceptedAt,
        localTermsAcceptedAt,
        needsPrivacyConsent,
        needsTermsConsent,
        acceptPrivacyLocally: async () => {
          const now = new Date().toISOString();
          try {
            await AsyncStorage.setItem(AUTH_STORAGE_KEYS.LOCAL_PRIVACY_ACCEPTED_AT, now);
          } catch (e) {
            logger.warn('acceptPrivacyLocally storage failed', e?.message);
          }
          setLocalPrivacyAcceptedAt(now);
        },
        acceptTermsLocally: async () => {
          const now = new Date().toISOString();
          try {
            await AsyncStorage.setItem(AUTH_STORAGE_KEYS.LOCAL_TERMS_ACCEPTED_AT, now);
          } catch (e) {
            logger.warn('acceptTermsLocally storage failed', e?.message);
          }
          setLocalTermsAcceptedAt(now);
        },
        acceptPrivacy: async () => {
          const now = new Date().toISOString();
          try {
            let tokenToUse = null;
            if (supabase?.auth) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.access_token) {
                if (session?.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 300) {
                  const { data: { session: refreshed } } = await refreshSessionWithRetry();
                  tokenToUse = refreshed?.access_token ?? session?.access_token;
                } else {
                  tokenToUse = session?.access_token;
                }
              }
            }
            const res = await api.post('/auth/privacy-accept', {}, tokenToUse ? { token: tokenToUse } : undefined);
            if (res?.data?.privacyPolicyAcceptedAt) {
              setPrivacyPolicyAcceptedAt(res.data.privacyPolicyAcceptedAt);
            }
          } catch (e) {
            const status = e?.response?.status;
            logger.warn('acceptPrivacy API failed, saving locally', status || e?.message);
            try {
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.LOCAL_PRIVACY_ACCEPTED_AT, now);
            } catch (_) {}
            setLocalPrivacyAcceptedAt(now);
            setPrivacyPolicyAcceptedAt(now);
          }
        },
        /** Kullanım şartları onayı (ISO tarih string veya true). Yoksa lobide onay ekranı gösterilir. */
        termsOfServiceAcceptedAt,
        acceptTerms: async () => {
          const now = new Date().toISOString();
          try {
            let tokenToUse = null;
            if (supabase?.auth) {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.access_token) {
                if (session?.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 300) {
                  const { data: { session: refreshed } } = await refreshSessionWithRetry();
                  tokenToUse = refreshed?.access_token ?? session?.access_token;
                } else {
                  tokenToUse = session?.access_token;
                }
              }
            }
            const res = await api.post('/auth/terms-accept', {}, tokenToUse ? { token: tokenToUse } : undefined);
            if (res?.data?.termsOfServiceAcceptedAt) {
              setTermsOfServiceAcceptedAt(res.data.termsOfServiceAcceptedAt);
            }
          } catch (e) {
            const status = e?.response?.status;
            logger.warn('acceptTerms API failed, saving locally', status || e?.message);
            try {
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.LOCAL_TERMS_ACCEPTED_AT, now);
            } catch (_) {}
            setLocalTermsAcceptedAt(now);
            setTermsOfServiceAcceptedAt(now);
          }
        },
        accountPendingDeletion,
        deletionAt,
        restoreAccount: async () => {
          try {
            const res = await api.post('/auth/restore-account');
            if (res?.data?.restored) {
              setAccountPendingDeletion(false);
              setDeletionAt(null);
              await refreshMe();
            }
          } catch (e) {
            logger.error('restoreAccount error', e);
            throw e;
          }
        },
        isGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
