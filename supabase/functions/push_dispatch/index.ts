import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/Bearer\s+/i, "");
  if (!token) {
    return new Response(
      JSON.stringify({ error: "Yetkilendirme gerekli" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Service role ile çağrı (backend'den admin push tetikleme): kullanıcı kontrolü atlanır
  const isServiceRole = token === serviceKey;
  if (!isServiceRole) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Gecersiz oturum" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (!["admin", "moderator"].includes(profile?.role || "")) {
      return new Response(
        JSON.stringify({ error: "Yetkiniz yok" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const { data: rows, error: fetchErr } = await supabase
    .from("notification_outbox")
    .select("id, target_user_ids, payload")
    .eq("status", "queued")
    .limit(50);

  if (fetchErr || !rows?.length) {
    return new Response(
      JSON.stringify({ processed: 0, message: "Kuyrukta kayit yok" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const tokensByUser = new Map<string, string[]>();
  const { data: tokenRows } = await supabase
    .from("user_push_tokens")
    .select("user_id, token");
  for (const row of tokenRows || []) {
    if (!tokensByUser.has(row.user_id)) tokensByUser.set(row.user_id, []);
    tokensByUser.get(row.user_id)!.push(row.token);
  }
  // Backend JWT ile kayıtlı token'lar (push_registrations): user_identifier = "supabase:UUID"
  const { data: regRows } = await supabase
    .from("push_registrations")
    .select("user_identifier, expo_push_token");
  for (const row of regRows || []) {
    const uid = typeof row?.user_identifier === "string" && row.user_identifier.startsWith("supabase:")
      ? row.user_identifier.slice("supabase:".length)
      : null;
    if (uid && row?.expo_push_token) {
      if (!tokensByUser.has(uid)) tokensByUser.set(uid, []);
      tokensByUser.get(uid)!.push(row.expo_push_token);
    }
  }

  let sent = 0;
  let failed = 0;

  for (const out of rows) {
    const userIds = (out.target_user_ids as string[]) || [];
    const allTokens: string[] = [];
    for (const uid of userIds) {
      const t = tokensByUser.get(uid) || [];
      allTokens.push(...t);
    }

    const payload = out.payload as { title?: string; body?: string; data?: Record<string, unknown> };
    const expoMessages = allTokens.map((t) => ({
      to: t,
      title: payload.title || "Bildirim",
      body: payload.body || "",
      data: payload.data || {},
      sound: "default",
    }));

    let ok = true;
    let lastError = "";
    if (expoMessages.length > 0) {
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(expoMessages),
        });
        const result = await res.json();
        if (result.data?.status === "error") {
          ok = false;
          lastError = JSON.stringify(result.data);
        } else if (!res.ok) {
          ok = false;
          lastError = await res.text();
        }
      } catch (e) {
        ok = false;
        lastError = String(e);
      }
    }

    await supabase
      .from("notification_outbox")
      .update({
        status: ok ? "sent" : "failed",
        sent_at: ok ? new Date().toISOString() : null,
        last_error: ok ? null : lastError,
      })
      .eq("id", out.id);

    if (ok) sent++;
    else failed++;
  }

  return new Response(
    JSON.stringify({
      processed: rows.length,
      sent,
      failed,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
