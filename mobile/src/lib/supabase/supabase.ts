import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const getConfig = () => {
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) {
    return {
      url: process.env.EXPO_PUBLIC_SUPABASE_URL,
      anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    };
  }
  try {
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    return {
      url: extra.supabaseUrl || '',
      anonKey: extra.supabaseAnonKey || '',
    };
  } catch {
    return { url: '', anonKey: '' };
  }
};

const { url, anonKey } = getConfig();

if (!url || !anonKey) {
  console.warn('[Supabase] Credentials missing or incomplete. Check mobile/.env: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (full JWT).');
}
if (anonKey && anonKey.length < 30) {
  console.warn('[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY çok kısa (publishable veya anon JWT olmalı). Check mobile/.env.');
}

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
