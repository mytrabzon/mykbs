/**
 * tRPC client for Supabase Edge Functions (single endpoint).
 * Uses Supabase session token for auth; same contract as callFn().
 */
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { getSupabaseBaseUrl } from '../../config/api';
import { supabase } from '../supabase/supabase';
import { ENV } from '../config/env';

const TRPC_URL = () => `${getSupabaseBaseUrl()}/functions/v1/trpc`;

async function getHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: ENV.SUPABASE_ANON_KEY,
  };
  if (token && !String(token).startsWith('stub_token_')) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Untyped tRPC proxy client. Use with:
 *   trpc.auth.me.query()
 *   trpc.rooms.list.query({ filtre: 'tumu' })
 *   trpc.rooms.get.query({ id: '...' })
 *   trpc.facilities.list.query()
 *   trpc.settings.get.query()
 */
export const trpc = createTRPCProxyClient({
  links: [
    httpLink({
      url: TRPC_URL(),
      headers: getHeaders,
    }),
  ],
});
