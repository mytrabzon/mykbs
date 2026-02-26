import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setApiTokenProvider, setOnUnauthorized } from '../services/api';
import { setDataServiceTokenProvider } from '../services/dataService';
import { logger } from '../utils/logger';

// Uygulama prefix'i (AsyncStorage izolasyonu için)
// app.config.js'deki slug kullanılıyor: "mykbs"
const APP_PREFIX = 'mykbs';

// Auth storage key'leri (uygulama prefix'i ile)
const AUTH_STORAGE_KEYS = {
  TOKEN: `@${APP_PREFIX}:auth:token`,
  USER: `@${APP_PREFIX}:auth:user`,
  TESIS: `@${APP_PREFIX}:auth:tesis`,
  SUPABASE_TOKEN: `@${APP_PREFIX}:auth:supabase_token`,
  /** Son açılan sekme (Odalar, Misafirler, ...) - güncellemelerde de korunur, sadece manuel çıkışta temizlenir */
  LAST_TAB: `@${APP_PREFIX}:auth:last_tab`,
};

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tesis, setTesis] = useState(null);
  const [token, setToken] = useState(null);
  const [supabaseToken, setSupabaseTokenState] = useState(null);
  const [lastTab, setLastTabState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Otomatik giriş kontrolü
  const isAuthenticated = !!token && !!user;

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      logger.log('Loading stored auth', { appPrefix: APP_PREFIX });
      const storedToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
      const storedUser = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.USER);
      const storedTesis = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TESIS);
      const storedSupabaseToken = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
      const storedLastTab = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.LAST_TAB);

      logger.log('Stored auth data', {
        hasToken: !!storedToken,
        hasUser: !!storedUser,
        hasTesis: !!storedTesis,
        hasSupabaseToken: !!storedSupabaseToken,
        lastTab: storedLastTab || undefined
      });

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setTesis(storedTesis ? JSON.parse(storedTesis) : null);
        setSupabaseTokenState(storedSupabaseToken);
        setLastTabState(storedLastTab || null);
        const getToken = async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
        const getSupabaseTokenForDataService = async () => (await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN)) || (await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN));
        setApiTokenProvider(getToken);
        setDataServiceTokenProvider(getSupabaseTokenForDataService);
        logger.log('Stored auth loaded successfully');
      } else {
        setApiTokenProvider(null);
        setDataServiceTokenProvider(null);
        setSupabaseTokenState(null);
        logger.log('No stored auth found');
      }
    } catch (error) {
      logger.error('Auth yükleme hatası', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSupabaseToken = async () => {
    return await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
  };

  const setSupabaseToken = async (accessToken) => {
    if (accessToken) {
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, accessToken);
      setSupabaseTokenState(accessToken);
    } else {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
      setSupabaseTokenState(null);
    }
  };

  // SMS ile giriş (OTP doğrulandıktan sonra token kaydet)
  // Backend supabase_access_token dönerse topluluk/bildirim özellikleri açılır
  const loginWithToken = async (token, kullanici, tesis, supabaseAccessToken) => {
    if (token == null || token === undefined) {
      logger.error('Login token save skipped: token is null/undefined');
      return { success: false, message: 'Oturum bilgisi alınamadı. Tekrar giriş yapın.' };
    }
    try {
      logger.log('Saving auth data to AsyncStorage', { appPrefix: APP_PREFIX });
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TOKEN, String(token));
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(kullanici));
      await AsyncStorage.setItem(AUTH_STORAGE_KEYS.TESIS, JSON.stringify(tesis));
      if (supabaseAccessToken) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN, supabaseAccessToken);
        setSupabaseTokenState(supabaseAccessToken);
      }

      setToken(token);
      setUser(kullanici);
      setTesis(tesis);
      const getToken = async () => await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN);
      const getSupabaseTokenForDataService = async () => (await AsyncStorage.getItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN)) || (await AsyncStorage.getItem(AUTH_STORAGE_KEYS.TOKEN));
      setApiTokenProvider(getToken);
      setDataServiceTokenProvider(getSupabaseTokenForDataService);

      logger.log('Login successful, auth state updated');
      return { success: true };
    } catch (error) {
      logger.error('Login token save error', error);
      return {
        success: false,
        message: 'Giriş bilgileri kaydedilemedi'
      };
    }
  };

  // Telefon veya e-posta + şifre ile giriş
  const loginWithPassword = async (telefonOrEmail, sifre) => {
    try {
      const isEmail = typeof telefonOrEmail === 'string' && telefonOrEmail.includes('@');
      const body = isEmail
        ? { email: telefonOrEmail.trim(), sifre }
        : { telefon: (telefonOrEmail || '').replace(/\D/g, '').replace(/^0/, '') || telefonOrEmail, sifre };
      logger.api('POST', '/auth/giris/yeni', { isEmail, len: telefonOrEmail?.length, hasPassword: !!sifre });

      const response = await api.post('/auth/giris/yeni', body);

      const { token: newToken, kullanici, tesis: tesisData } = response.data || {};
      if (!newToken || !kullanici) {
        const msg = response.data?.message || 'Giriş yanıtında oturum bilgisi yok. OTP ile giriş kullanıyorsanız doğrulama ekranına yönlendirilmelisiniz.';
        return { success: false, message: msg };
      }
      return await loginWithToken(newToken, kullanici, tesisData);
    } catch (error) {
      logger.error('Login with password error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return {
        success: false,
        message: error.response?.data?.message || 'Giriş başarısız'
      };
    }
  };

  // Deprecated: PIN ile giriş (eski sistem)
  const login = async (tesisKodu, pin) => {
    try {
      logger.api('POST', '/auth/giris', { tesisKodu, pinLength: pin.length });
      
      const response = await api.post('/auth/giris', {
        tesisKodu,
        pin
      });

      logger.api('POST', '/auth/giris', null, {
        status: response.status,
        hasToken: !!response.data.token,
        hasUser: !!response.data.kullanici,
        hasTesis: !!response.data.tesis
      });

      const { token: newToken, kullanici, tesis: tesisData } = response.data;

      return await loginWithToken(newToken, kullanici, tesisData);
    } catch (error) {
      logger.error('Login API error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return {
        success: false,
        message: error.response?.data?.message || 'Giriş başarısız'
      };
    }
  };

  const aktivasyon = async (tesisKodu, aktivasyonSifre) => {
    try {
      const response = await api.post('/auth/aktivasyon', {
        tesisKodu,
        aktivasyonSifre
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Aktivasyon başarısız'
      };
    }
  };

  const setPin = async (pin, biyometriAktif) => {
    try {
      await api.post('/auth/pin', { pin, biyometriAktif });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'PIN kaydedilemedi'
      };
    }
  };

  /** Son görüntülenen sekmeyi kaydet (uygulama/güncelleme sonrası aynı sekme açılır) */
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
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TOKEN);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.USER);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.TESIS);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.SUPABASE_TOKEN);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.LAST_TAB);
    setToken(null);
    setUser(null);
    setTesis(null);
    setSupabaseTokenState(null);
    setLastTabState(null);
    setApiTokenProvider(null);
    setDataServiceTokenProvider(null);
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
        token,
        supabaseToken,
        lastTab,
        setLastTab,
        isAuthenticated: !!token,
        isLoading,
        login,
        loginWithPassword,
        loginWithToken,
        aktivasyon,
        setPin,
        logout,
        getSupabaseToken,
        setSupabaseToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

