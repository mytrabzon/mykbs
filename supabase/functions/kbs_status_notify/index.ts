import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, jsonResponse, errorResponse } from "../_shared/auth.ts";

/**
 * Backend (veya güvenilir servis) KBS bildirim sonucunu bildirmek için çağırır.
 * Örnek: 202 numaralı odaya 5 kimlik bildirimi başarılı/başarısız.
 * Authorization: Bearer <service_role_key> veya x-api-key ile.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders() });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("x-api-key");
  const token = authHeader?.replace(/Bearer\s+/i, "").trim() || authHeader;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!token || token !== serviceKey) {
    return errorResponse("Yetkisiz", 401);
  }

  let body: {
    branch_id: string;
    room_number: string;
    count: number;
    success: boolean;
    message?: string;
  };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Gecersiz JSON", 400);
  }

  if (!body.branch_id) return errorResponse("branch_id gerekli", 400);
  if (!body.room_number) return errorResponse("room_number gerekli", 400);
  const count = Math.max(0, Number(body.count) || 0);
  const success = Boolean(body.success);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const title = "KBS Kimlik Bildirimi";
  const bodyText =
    body.message ||
    (success
      ? `${body.room_number} numaralı odaya ${count} kimlik bildirimi başarıyla gönderildi.`
      : `${body.room_number} numaralı odaya ${count} kimlik bildirimi gönderilemedi.`);

  const { data: branchUsers, error: usersErr } = await supabase
    .from("user_profiles")
    .select("user_id")
    .eq("branch_id", body.branch_id)
    .eq("is_disabled", false);

  if (usersErr) {
    console.error("kbs_status_notify users error:", usersErr);
    return errorResponse(usersErr.message, 500);
  }

  const userIds = (branchUsers || []).map((r: { user_id: string }) => r.user_id);
  if (userIds.length === 0) {
    return jsonResponse({ success: true, notified: 0 });
  }

  const notifs = userIds.map((uid: string) => ({
    branch_id: body.branch_id,
    user_id: uid,
    type: "kbs_status",
    title,
    body: bodyText,
    data: {
      room_number: body.room_number,
      count,
      success,
    },
  }));

  const { error: notifErr } = await supabase.from("in_app_notifications").insert(notifs);
  if (notifErr) {
    console.error("kbs_status_notify in_app insert error:", notifErr);
    return errorResponse(notifErr.message, 500);
  }

  await supabase.from("notification_outbox").insert({
    branch_id: body.branch_id,
    target_user_ids: userIds,
    payload: {
      title,
      body: bodyText,
      data: { room_number: body.room_number, count, success, type: "kbs_status" },
    },
    status: "queued",
  });

  return jsonResponse({ success: true, notified: userIds.length });
});
