import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setApiTokenProvider, setOnUnauthorized } from '../services/api';
import { dataService, setDataServiceTokenProvider } from '../services/dataService';
import { logger } from '../utils/logger';
import { supabase } from '../lib/supabase/supabase';

const APP_PREFIX = 'mykbs';

const AUTH_STORAGE_KEYS = {
  TOKEN: `@${APP_PREFIX}:auth:token`,
  USER: `@${APP_PREFIX}:auth:user`,
  TESIS: `@${APP_PREFIX}:auth:tesis`,
  SUPABASE_TOKEN: `@${APP_PREFIX}:auth:supabase_token`,
  LAST_TAB: `@${APP_PREFIX}:auth:last_tab`,
  RECOVERY_PENDING: `@${APP_PREFIX}:auth:recovery_pending`,
};

const AuthContext = createContext({});

/**
 * Token ile /auth/me çağırıp user/tesis state'ini günceller.
 * @returns {Promise<boolean>} true = kullanıcı/tesis set edildi veya zaten token geçerli; false = 401 ile oturum temizlendi (giriş başarısız).
 */
async function fetchMeAndSetState(accessToken, setUser, setTesis, setToken, getTokenProvider) {
  if (!accessToken) return false;
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, accessToken);
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, accessToken);
  setToken(accessToken);
  const getToken = getTokenProvider ? getTokenProvider() : (async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN));
  setApiTokenProvider(getToken);
  setDataServiceTokenProvider(getToken);
  try {
    const res = await api.get('/auth/me');
    const { kullanici, tesis: tesisData } = res.data || {};
    if (kullanici) {
      setUser(kullanici);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(kullanici));
    }
    if (tesisData) {
      setTesis(tesisData);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(tesisData));
    }
    return true;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 401) {
      try {
        await supabase?.auth?.signOut();
      } catch (_) {}
      await AsyncStorage.multiRemove([AUTH_STORAGE_KEYS.TOKEN, AUTH_STORAGE_KEYS.SUPABASE_TOKEN, AUTH_STORAGE_KEYS.USER, AUTH_STORAGE_KEYS.TESIS]);
      setToken(null);
      setUser(null);
      setTesis(null);
      return false;
    }
    logger.error('AuthContext fetch /me failed', e);
    return true; // Diğer hatalarda token'ı tutuyoruz, kullanıcı sonra tekrar dener
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tesis, setTesis] = useState(null);
  const [token, setToken] = useState(null);
  const [lastTab, setLastTabState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [recoverySessionPending, setRecoverySessionPending] = useState(false);
  const mounted = useRef(true);

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
            const { data: { session: refreshed }, error } = await supabase.auth.refreshSession();
            if (!error && refreshed?.access_token) {
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, refreshed.access_token);
              await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, refreshed.access_token);
              setToken(refreshed.access_token);
              return refreshed.access_token;
            }
            return session.access_token;
          }
        }
      } catch (e) {
        logger.warn('getSupabaseAwareTokenProvider getSession/refresh failed, using storage', e?.message || e);
      }
      return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
    };
  };

  const isAuthenticated = !!token && !!user;

  const clearAuth = async () => {
    // Önce state temizle ki ekran hemen girişe dönsün (tek tıkla çıkış)
    setToken(null);
    setUser(null);
    setTesis(null);
    setLastTabState(null);
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
      try {
        const storedLastTab = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.LAST_TAB);
        if (storedLastTab) setLastTabState(storedLastTab);

        if (supabase) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          const session = !refreshError && refreshedSession?.access_token
            ? refreshedSession
            : (await supabase.auth.getSession()).data?.session;
          if (session?.access_token && mounted.current) {
            await fetchMeAndSetState(session.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider);
          } else {
            // Supabase oturumu yok: backend JWT (telefon+şifre girişi) ile kayıtlı token varsa doğrula
            const storedToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
            const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
            const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
            if (storedToken && storedUser && mounted.current) {
              setToken(storedToken);
              setUser(JSON.parse(storedUser));
              setTesis(storedTesis ? JSON.parse(storedTesis) : null);
              const getToken = async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
              setApiTokenProvider(getToken);
              setDataServiceTokenProvider(() => getToken());
              try {
                const res = await api.get('/auth/me');
                if (res?.data && mounted.current) {
                  setUser(res.data.kullanici ?? res.data.user);
                  setTesis(res.data.tesis ?? res.data.tesisData ?? null);
                  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(res.data.kullanici ?? res.data.user));
                  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(res.data.tesis ?? res.data.tesisData ?? null));
                }
              } catch (e) {
                if (e?.response?.status === 401 && mounted.current) {
                  await clearAuth();
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
              await fetchMeAndSetState(session.access_token, setUser, setTesis, setToken, getSupabaseAwareTokenProvider);
            }
          });
        } else {
          const storedToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
          const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
          const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
          if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
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

  // Önce canlı Supabase oturumunu kullan; yoksa storage'daki SUPABASE_TOKEN (backend sadece Supabase token dönmüşse geçerli).
  // Edge me/upload_community_image vb. sadece Supabase Auth JWT ile çalışır; backend JWT 401 (INVALID_TOKEN) döner.
  const getSupabaseToken = async () => {
    if (supabase?.auth) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) return session.access_token;
    }
    return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
  };

  const refreshMe = async () => {
    const accessToken = await getSupabaseToken();
    if (accessToken) {
      await fetchMeAndSetState(accessToken, setUser, setTesis, setToken, supabase ? getSupabaseAwareTokenProvider : undefined);
      return;
    }
    const backendToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
    if (backendToken) {
      try {
        const res = await api.get('/auth/me');
        if (res?.data && mounted.current) {
          setUser(res.data.kullanici ?? res.data.user);
          setTesis(res.data.tesis ?? res.data.tesisData);
        }
      } catch (_) {}
    }
  };

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
        setUser(kullanici);
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(kullanici));
      }
      if (tesisData) {
        setTesis(tesisData);
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(tesisData));
      }
      if (!kullanici || !tesisData) {
        const fetched = await fetchMeAndSetState(tokenForApi, setUser, setTesis, setToken, supabase ? getSupabaseAwareTokenProvider : undefined);
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
      const { token: newToken, kullanici, tesis: tesisData } = res.data || {};
      if (newToken && kullanici && tesisData) {
        // Supabase token dönmediği için null: profil/topluluk Edge çağrıları şifre ile girişte 401 verir; OTP giriş gerekir.
        return await loginWithToken(newToken, kullanici, tesisData, null);
      }
      return { success: false, message: res.data?.message || 'Giriş başarısız' };
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message;
      logger.error('Login with password error', err);
      return { success: false, message: msg || 'Giriş başarısız' };
    }
  };

  const loginWithPhoneAndPassword = async (telefon, sifre) => {
    try {
      const response = await api.post('/auth/giris/yeni', { telefon, sifre });
      const { token: newToken, kullanici, tesis: tesisData } = response.data || {};
      if (!newToken || !kullanici) {
        return { success: false, message: response.data?.message || 'Giriş başarısız' };
      }
      return await loginWithToken(newToken, kullanici, tesisData, null);
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Giriş başarısız',
      };
    }
  };

  const resetPasswordForEmail = async (emailAddress) => {
    if (!supabase) {
      return { success: false, message: 'Şifre sıfırlama servisi kullanılamıyor.' };
    }
    try {
      // Şifre sıfırlama linki uygulamada açılsın (Supabase Dashboard → Auth → URL Configuration'da mykbs://reset-password ekleyin)
      const redirectTo = 'mykbs://reset-password';
      const { error } = await supabase.auth.resetPasswordForEmail((emailAddress || '').trim().toLowerCase(), {
        redirectTo,
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid') && msg.includes('credential')) {
          return { success: false, message: 'Bu e-posta ile giriş yapılmıyor. Telefon ile kayıt olduysanız yukarıdaki "Kod Gönder" ile şifre sıfırlayabilirsiniz.' };
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

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
    return () => setOnUnauthorized(null);
  }, []);

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
        isAuthenticated: !!token && !!user,
        isLoading,
        recoverySessionPending,
        clearRecoveryPending: () => { setRecoverySessionPending(false); },
        login,
        loginWithPassword,
        loginWithPhoneAndPassword,
        loginWithToken,
        resetPasswordForEmail,
        aktivasyon,
        setPin,
        logout,
        getSupabaseToken,
        setSupabaseToken,
        refreshMe,
        setTesis,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
