const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKEND_URL = Deno.env.get("BACKEND_URL") || "";

/** E.164: sadece rakam, +90 ile başlar (backend ile aynı normalizasyon) */
function formatPhone(telefon: string): string {
  const digits = (telefon || "").replace(/\D/g, "");
  if (!digits.length) return "";
  const normalized = digits.startsWith("90") ? digits : (digits.startsWith("0") ? "90" + digits.slice(1) : "90" + digits);
  return "+" + normalized.slice(0, 12);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const telefon = body.telefon as string | undefined;
    if (!telefon) {
      return new Response(
        JSON.stringify({ message: "Telefon numarası gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Backend varsa isteği oraya yönlendir
    if (BACKEND_URL) {
      const base = BACKEND_URL.replace(/\/$/, "");
      const isDirectKayit = !!(body.sifre && body.sifreTekrar && body.adSoyad);
      if (isDirectKayit) {
        const res = await fetch(`${base}/auth/kayit`, {
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
      const isKayitOtp = !!(body.islemTipi === "kayit" || (body.telefon && body.adSoyad && !body.sifre));
      const url = isKayitOtp ? `${base}/auth/kayit/otp-iste` : `${base}/auth/giris/otp-iste`;
      const payload = { telefon };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

    // Backend yoksa: OTP üret, Supabase send-sms'i çağır (kod Supabase log'da görünür)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const formattedPhone = formatPhone(telefon);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const message = `MyKBS giriş kodunuz: ${otp}\n\nBu kodu kimseyle paylaşmayın. Kod 5 dakika geçerlidir.`;

    const sendSmsUrl = `${supabaseUrl}/functions/v1/send-sms`;
    await fetch(sendSmsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message,
        otp,
        type: "otp",
      }),
    }).catch((e) => console.error("send-sms call failed:", e));

    console.log("OTP (log):", { phone: formattedPhone, otp });

    const devOtpHint = Deno.env.get("DEV_OTP_IN_RESPONSE") === "true";
    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS gönderildi. Lütfen telefonunuzdaki doğrulama kodunu girin.",
        telefon: formattedPhone,
        otpExpiresIn: 5,
        ...(devOtpHint && { otpForDev: otp }),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Beklenmeyen hata";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
