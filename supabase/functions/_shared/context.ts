/**
 * tRPC request context: Supabase client (service role) + optional authenticated user.
 * Mirrors requireAuth() behaviour: JWT validated via getUser(), profile loaded from user_profiles.
 * Used by protectedProcedure; publicProcedure can still run with user === null.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface UserProfile {
  user_id: string;
  branch_id: string;
  role: string;
  display_name: string | null;
  title: string | null;
  avatar_url: string | null;
  is_disabled: boolean;
  approval_status: string;
}

export interface AuthUser {
  id: string;
  profile: UserProfile;
}

export interface Context {
  supabase: ReturnType<typeof createClient>;
  user: AuthUser | null;
}

export async function createContext(req: Request): Promise<Context> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/Bearer\s+/i, "");

  if (!token) {
    return { supabase, user: null };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { supabase, user: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id, branch_id, role, display_name, title, avatar_url, is_disabled, approval_status")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return { supabase, user: null };
  }

  const prof = profile as UserProfile;
  if (prof.is_disabled) {
    return { supabase, user: null };
  }

  return {
    supabase,
    user: {
      id: user.id,
      profile: prof,
    },
  };
}
