import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAdminOrMod,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const auth = await requireAdminOrMod(req);
  if (auth instanceof Response) return auth;

  let body: { branch_id?: string; role?: string; disabled?: boolean };
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  let query = auth.supabase
    .from("user_profiles")
    .select("user_id, branch_id, role, display_name, title, avatar_url, is_disabled");

  if (body.branch_id) {
    if (body.branch_id !== auth.profile.branch_id && auth.profile.role !== "admin") {
      return errorResponse("Bu tesis icin yetkiniz yok", 403);
    }
    query = query.eq("branch_id", body.branch_id);
  } else {
    query = query.eq("branch_id", auth.profile.branch_id);
  }
  if (body.role) query = query.eq("role", body.role);
  if (body.disabled === true) query = query.eq("is_disabled", true);
  if (body.disabled === false) query = query.eq("is_disabled", false);

  const { data: users, error } = await query.order("display_name");

  if (error) {
    console.error("admin_user_list error:", error);
    return errorResponse(error.message, 500);
  }
  return jsonResponse({ users: users || [] });
});
