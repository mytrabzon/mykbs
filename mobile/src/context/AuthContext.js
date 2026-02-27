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
};

const AuthContext = createContext({});

async function fetchMeAndSetState(accessToken, setUser, setTesis, setToken) {
  if (!accessToken) return;
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, accessToken);
  await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, accessToken);
  setToken(accessToken);
  const getToken = async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
  setApiTokenProvider(getToken);
  setDataServiceTokenProvider(() => getToken());
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
    } else {
      logger.error('AuthContext fetch /me failed', e);
    }
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tesis, setTesis] = useState(null);
  const [token, setToken] = useState(null);
  const [lastTab, setLastTabState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const mounted = useRef(true);

  const isAuthenticated = !!token && !!user;

  const clearAuth = async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TESIS);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.LAST_TAB);
    setToken(null);
    setUser(null);
    setTesis(null);
    setLastTabState(null);
    setApiTokenProvider(null);
    setDataServiceTokenProvider(null);
    // Önceki kullanıcının oda/misafir/tesis cache'ini temizle; başka kullanıcı verisi görünmesin
    try {
      await dataService.clearCache();
    } catch (e) {
      logger.error('Cache clear on logout error', e);
    }
  };

  useEffect(() => {
    mounted.current = true;
    let sub;

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
            await fetchMeAndSetState(session.access_token, setUser, setTesis, setToken);
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
              await fetchMeAndSetState(session.access_token, setUser, setTesis, setToken);
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
        if (mounted.current) setIsLoading(false);
      }
    }

    init();
    return () => {
      mounted.current = false;
      if (sub?.unsubscribe) sub.unsubscribe();
    };
  }, []);

  // Sadece gerçek Supabase access_token döndür. Backend JWT (TOKEN) Edge Function'lara gönderilmemeli.
  const getSupabaseToken = async () => {
    return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
  };

  const refreshMe = async () => {
    const accessToken = await getSupabaseToken();
    if (accessToken) {
      await fetchMeAndSetState(accessToken, setUser, setTesis, setToken);
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
    const hasTwoTokens = tokenVal && supabaseAccessToken && tokenVal !== supabaseAccessToken;
    const tokenForApi = hasTwoTokens ? tokenVal : (supabaseAccessToken || tokenVal);
    const tokenForSupabase = supabaseAccessToken || tokenVal;
    if (!tokenForApi) {
      return { success: false, message: 'Oturum bilgisi alınamadı.' };
    }
    try {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, tokenForApi);
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, tokenForSupabase);
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
        await fetchMeAndSetState(tokenForApi, setUser, setTesis, setToken);
      }
      return { success: true };
    } catch (error) {
      logger.error('Login token save error', error);
      return { success: false, message: 'Giriş bilgileri kaydedilemedi' };
    }
  };

  const loginWithPassword = async (email, sifre) => {
    if (!supabase) {
      return { success: false, message: 'Giriş servisi kullanılamıyor.' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: sifre,
      });
      if (error) {
        return { success: false, message: error.message || 'Giriş başarısız' };
      }
      if (data?.session?.access_token) {
        await fetchMeAndSetState(data.session.access_token, setUser, setTesis, setToken);
        return { success: true };
      }
      return { success: false, message: 'Oturum alınamadı.' };
    } catch (error) {
      logger.error('Login with password error', error);
      return { success: false, message: error?.message || 'Giriş başarısız' };
    }
  };

  const loginWithPhoneAndPassword = async (telefon, sifre) => {
    try {
      const response = await api.post('/auth/giris/yeni', { telefon, sifre });
      const { token: newToken, kullanici, tesis: tesisData } = response.data || {};
      if (!newToken || !kullanici) {
        return { success: false, message: response.data?.message || 'Giriş başarısız' };
      }
      return await loginWithToken(newToken, kullanici, tesisData, newToken);
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Giriş başarısız',
      };
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

  const logout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        logger.error('Supabase signOut error', e);
      }
    }
    await clearAuth();
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
        login,
        loginWithPassword,
        loginWithPhoneAndPassword,
        loginWithToken,
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
