import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/env';

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Supabase Auth /token sometimes returns 500 "context canceled" (client disconnect or LB timeout). Retry once after a short delay. */
const REFRESH_RETRY_DELAY_MS = 600;

export async function refreshSessionWithRetry() {
  const result = await supabase.auth.refreshSession();
  const msg = result.error?.message ?? '';
  const shouldRetry =
    result.error &&
    (msg.includes('context canceled') || msg.includes('500') || msg.includes('error finding refresh token'));
  if (shouldRetry) {
    await new Promise((r) => setTimeout(r, REFRESH_RETRY_DELAY_MS));
    return supabase.auth.refreshSession();
  }
  return result;
}
