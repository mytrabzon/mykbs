import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKEND_URL = Deno.env.get("BACKEND_URL") || "";

function formatPhone(telefon: string): string {
  const digits = (telefon || "").replace(/\D/g, "");
  if (!digits.length) return "";
  const n = digits.startsWith("90") ? digits : digits.startsWith("0") ? "90" + digits.slice(1) : "90" + digits;
  return "+" + n.slice(0, 12);
}

/** access_token ile kullanıcı + tesis döndür (auth_supabase_phone_session ile aynı mantık) */
async function sessionToAppPayload(accessToken: string) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !user) return null;

    const admin = createClient(supabaseUrl, supabaseServiceKey);
    const profileRes = await admin.from("user_profiles").select("branch_id, role, display_name").eq("user_id", user.id).limit(1);
    let profile = (profileRes.data as { branch_id: string; role: string; display_name: string | null }[] | null)?.[0] ?? null;
    let branchId = profile?.branch_id;

    if (!branchId) {
      const orgRes = await admin.from("organizations").insert({ name: "Tesisim" }).select("id").single();
      const orgId = (orgRes.data as { id?: string } | null)?.id;
      if (!orgId) return null;
      const branchRes = await admin.from("branches").insert({ organization_id: orgId, name: "Ana Tesis" }).select("id").single();
      const newBranchId = (branchRes.data as { id?: string } | null)?.id;
      if (!newBranchId) return null;
      const displayName = (user.user_metadata?.full_name as string) || (user.phone ? `Kullanıcı ${user.phone.slice(-4)}` : "Kullanıcı");
      await admin.from("user_profiles").insert({
        user_id: user.id,
        branch_id: newBranchId,
        role: "staff",
        display_name: displayName,
      });
      branchId = newBranchId;
      profile = { branch_id: newBranchId, role: "staff", display_name: displayName };
    }

    const branch = await admin.from("branches").select("id, name, organization_id").eq("id", branchId).single().then((r) => r.data as { id: string; name: string; organization_id: string } | null);
    const org = branch?.organization_id
      ? await admin.from("organizations").select("id, name").eq("id", branch.organization_id).single().then((r) => r.data as { id: string; name: string } | null)
      : null;

    const tesis = {
      id: branch?.id,
      tesisAdi: branch?.name || "Tesis",
      paket: "standard",
      kota: 100,
      kullanilanKota: 0,
      kbsTuru: "polis",
      organization: org ?? undefined,
    };
    const kullanici = {
      id: user.id,
      adSoyad: profile?.display_name || user.phone || user.email || "Kullanıcı",
      email: user.email ?? null,
      telefon: user.phone ?? "",
      rol: profile?.role || "staff",
    };
    return { token: accessToken, kullanici, tesis, supabaseAccessToken: accessToken };
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    // 1) access_token gelmişse (client zaten verifyOtp yaptı) → sadece kullanıcı/tesis döndür
    const accessToken = (body.access_token as string) || (req.headers.get("Authorization")?.replace(/Bearer\s+/i, "") || "");
    if (accessToken) {
      const payload = await sessionToAppPayload(accessToken);
      if (payload) {
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Backend varsa isteği oraya yönlendir (kayıt veya giriş)
    if (BACKEND_URL) {
      const base = BACKEND_URL.replace(/\/$/, "");
      const isKayit = !!(body.adSoyad || body.tesisAdi || body.email != null);
      const url = isKayit ? `${base}/auth/kayit/dogrula` : `${base}/auth/giris/otp-dogrula`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = { message: text || res.statusText };
      }
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Sadece telefon + OTP ile Supabase üzerinden doğrula (bağlantı tek noktada)
    const telefon = body.telefon as string | undefined;
    const otp = body.otp as string | undefined;
    if (telefon && otp && String(otp).length >= 6) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const phone = formatPhone(telefon);
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ type: "sms", phone, token: String(otp).trim() }),
      });
      const verifyData = await verifyRes.json().catch(() => ({})) as { access_token?: string; error?: string; msg?: string };
      if (verifyRes.ok && verifyData.access_token) {
        const payload = await sessionToAppPayload(verifyData.access_token);
        if (payload) {
          return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      const errMsg = (verifyData as { error_description?: string }).error_description || (verifyData as { msg?: string }).msg || "Kod geçersiz";
      return new Response(
        JSON.stringify({ message: errMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Stub sadece test için; production'da kapalı
    if (Deno.env.get("ALLOW_STUB_OTP") === "true") {
      const token = "stub_token_" + Date.now();
      const kullanici = { id: "stub-user", adSoyad: "Test", email: null, telefon: body.telefon || "", rol: "sahip" };
      const tesis = { id: "stub-tesis", tesisAdi: "Test Tesis", tesisKodu: "STUB", paket: "deneme", kota: 500, kullanilanKota: 0 };
      return new Response(JSON.stringify({ token, kullanici, tesis }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ message: "Geçerli giriş yöntemi gerekli: OTP kodu veya backend adresi (BACKEND_URL) tanımlayın.", code: "AUTH_REQUIRED" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Beklenmeyen hata";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
