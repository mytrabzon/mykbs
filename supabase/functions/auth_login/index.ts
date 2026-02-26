const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({})) as { tesisKodu?: string; pin?: string };
  const token = "stub_token_" + Date.now();
  const kullanici = { id: "stub-user", ad: "Test", soyad: "Kullanici" };
  const tesis = { id: "stub-tesis", tesisAdi: "Test Tesis" };
  return new Response(JSON.stringify({ token, kullanici, tesis }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
