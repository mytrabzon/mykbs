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

  let body: { user_id: string; disabled: boolean };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }
  if (!body.user_id) return errorResponse("user_id gerekli", 400);
  const disabled = Boolean(body.disabled);

  const { data: target, error: fetchErr } = await auth.supabase
    .from("user_profiles")
    .select("user_id, branch_id, is_disabled")
    .eq("user_id", body.user_id)
    .single();

  if (fetchErr || !target) return errorResponse("Kullanici bulunamadi", 404);
  if (target.branch_id !== auth.profile.branch_id) {
    return errorResponse("Bu tesis icin yetkiniz yok", 403);
  }
  if (body.user_id === auth.userId) {
    return errorResponse("Kendinizi devre disi birakamazsiniz", 400);
  }

  const { error: updateErr } = await auth.supabase
    .from("user_profiles")
    .update({ is_disabled: disabled })
    .eq("user_id", body.user_id);

  if (updateErr) {
    console.error("admin_user_disable error:", updateErr);
    return errorResponse(updateErr.message, 500);
  }

  await writeAudit(auth.supabase, {
    branch_id: target.branch_id,
    user_id: auth.userId,
    action: disabled ? "user_disable" : "user_enable",
    entity: "user_profiles",
    entity_id: body.user_id,
  });

  return jsonResponse({ success: true, disabled });
});
