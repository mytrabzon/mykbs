import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface UserProfile {
  user_id: string;
  branch_id: string;
  role: string;
  display_name: string | null;
  title: string | null;
  avatar_url: string | null;
  is_disabled: boolean;
}

export interface AuthResult {
  userId: string;
  profile: UserProfile;
  supabase: ReturnType<typeof createClient>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function getCorsHeaders() {
  return corsHeaders;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

export function errorResponse(
  message: string,
  status = 400,
  code?: string
) {
  return jsonResponse({ error: message, code: code || "ERROR" }, status);
}

/**
 * Authorization: Bearer <jwt> ile istegi dogrula, user + profile dondur.
 * is_disabled ise 403.
 */
export async function requireAuth(req: Request): Promise<AuthResult | Response> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/Bearer\s+/i, "");

  if (!token) {
    return errorResponse("Yetkilendirme gerekli", 401, "UNAUTHORIZED");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return errorResponse("Gecersiz veya suresi dolmus oturum", 401, "UNAUTHORIZED");
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id, branch_id, role, display_name, title, avatar_url, is_disabled")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return errorResponse("Kullanici profili bulunamadi", 403, "NO_PROFILE");
  }

  if (profile.is_disabled) {
    return errorResponse("Hesabiniz devre disi birakildi", 403, "DISABLED");
  }

  return {
    userId: user.id,
    profile: profile as UserProfile,
    supabase,
  };
}

/** Sadece admin veya moderator gecer */
export async function requireAdminOrMod(
  req: Request
): Promise<AuthResult | Response> {
  const result = await requireAuth(req);
  if (result instanceof Response) return result;
  if (!["admin", "moderator"].includes(result.profile.role)) {
    return errorResponse("Bu islem icin yetkiniz yok", 403, "FORBIDDEN");
  }
  return result;
}

/** Audit log yaz */
export async function writeAudit(
  supabase: ReturnType<typeof createClient>,
  params: {
    branch_id: string;
    user_id: string;
    action: string;
    entity: string;
    entity_id?: string | null;
    meta?: Record<string, unknown> | null;
  }
) {
  await supabase.from("audit_logs").insert({
    branch_id: params.branch_id,
    user_id: params.user_id,
    action: params.action,
    entity: params.entity,
    entity_id: params.entity_id ?? null,
    meta_json: params.meta ?? null,
  });
}
