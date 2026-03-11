import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAuth,
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

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  const { data: profileRow } = await auth.supabase
    .from("profiles")
    .select("is_admin, is_super_admin")
    .eq("id", auth.userId)
    .maybeSingle();
  const is_admin = profileRow?.is_admin === true;
  const is_super_admin = profileRow?.is_super_admin === true;
  const role = (is_super_admin || is_admin) ? "admin" : auth.profile.role;

  return jsonResponse({
    user_id: auth.userId,
    branch_id: auth.profile.branch_id,
    role,
    display_name: auth.profile.display_name,
    title: auth.profile.title,
    avatar_url: auth.profile.avatar_url,
    is_admin: is_admin || is_super_admin,
  });
});
