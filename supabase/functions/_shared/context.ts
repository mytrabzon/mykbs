import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface Context {
  supabase: ReturnType<typeof createClient>;
  user?: any;
}

export function createContext(req: Request): Context {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Request'ten authorization header'ı al
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Service role key ile admin client oluştur
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return {
    supabase,
    user: token ? { token } : undefined
  };
}

