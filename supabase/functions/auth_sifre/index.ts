import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ message: "Yetkisiz" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({})) as { sifre?: string; sifreTekrar?: string };
    const { sifre, sifreTekrar } = body;
    if (!sifre || !sifreTekrar) {
      return new Response(JSON.stringify({ message: "Şifre ve şifre tekrarı gereklidir" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (sifre !== sifreTekrar) {
      return new Response(JSON.stringify({ message: "Şifreler eşleşmiyor" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (sifre.length < 6) {
      return new Response(JSON.stringify({ message: "Şifre en az 6 karakter olmalıdır" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { error } = await supabase.auth.updateUser({ password: sifre });
    if (error) {
      return new Response(JSON.stringify({ message: error.message || "Şifre güncellenemedi" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ message: "Şifre başarıyla kaydedildi. Telefon veya email + şifre ile giriş yapabilirsiniz." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Beklenmeyen hata";
    return new Response(JSON.stringify({ message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
