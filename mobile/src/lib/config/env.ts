// Runtime env: önce process.env (Expo dev), yoksa EAS build'in gömdüğü extra.
import Constants from 'expo-constants';

const fromProcess = (k: string) => (process.env as Record<string, string | undefined>)?.[k];

const extra =
  (Constants.expoConfig?.extra as Record<string, unknown>) ??
  (Constants.manifest2 as { extra?: Record<string, unknown> })?.extra ??
  (Constants.manifest as { extra?: Record<string, unknown> })?.extra ??
  {};

const must = (k: string, v?: string): string => {
  if (!v) throw new Error(`${k} tanımlanmamış`);
  return v;
};

export const ENV = {
  SUPABASE_URL: must(
    'EXPO_PUBLIC_SUPABASE_URL',
    fromProcess('EXPO_PUBLIC_SUPABASE_URL') ?? (extra.supabaseUrl as string)
  ),
  SUPABASE_ANON_KEY: must(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    fromProcess('EXPO_PUBLIC_SUPABASE_ANON_KEY') ?? (extra.supabaseAnonKey as string)
  ),
  BACKEND_URL: must(
    'EXPO_PUBLIC_BACKEND_URL',
    fromProcess('EXPO_PUBLIC_BACKEND_URL') ?? (extra.backendUrl as string)
  ),
};
