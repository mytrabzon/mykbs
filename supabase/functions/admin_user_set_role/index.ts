import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  requireAdminOrMod,
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  writeAudit,
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

  let body: { user_id: string; role: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.user_id) return errorResponse("user_id gerekli", 400);
  const role = (body.role || "").toLowerCase();
  if (!["admin", "moderator", "operator", "viewer"].includes(role)) {
    return errorResponse("role: admin, moderator, operator veya viewer olmali", 400);
  }

  const { data: target, error: fetchErr } = await auth.supabase
    .from("user_profiles")
    .select("user_id, branch_id, role")
    .eq("user_id", body.user_id)
    .single();

  if (fetchErr || !target) return errorResponse("Kullanici bulunamadi", 404);
  if (target.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }
  if (auth.profile.role !== "admin" && role === "admin") {
    return errorResponse("Sadece admin baska admin atayabilir", 403);
  }

  const { error: updateErr } = await auth.supabase
    .from("user_profiles")
    .update({ role })
    .eq("user_id", body.user_id);

  if (updateErr) {
    console.error("admin_user_set_role error:", updateErr);
    return errorResponse(updateErr.message, 500);
  }

  await writeAudit(auth.supabase, {
    branch_id: target.branch_id,
    user_id: auth.userId,
    action: "user_set_role",
    entity: "user_profiles",
    entity_id: body.user_id,
    meta: { previous_role: target.role, new_role: role },
  });

  return jsonResponse({ success: true, role });
});
