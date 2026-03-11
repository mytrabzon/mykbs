import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ message: "Yetkisiz" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ message: "Oturum gecersiz" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("branch_id")
      .eq("user_id", user.id)
      .single();
    const branchId = (profile as { branch_id?: string } | null)?.branch_id;
    if (!branchId) {
      return new Response(JSON.stringify({ message: "Branch bulunamadi" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ad = (body.ad as string) || "";
    const soyad = (body.soyad as string) || "";
    const fullName = [ad, soyad].filter(Boolean).join(" ") || "Misafir";
    const { data: guest, error: guestErr } = await supabase
      .from("guests")
      .insert({
        branch_id: branchId,
        full_name: fullName,
        nationality: (body.uyruk as string) || null,
        document_type: body.kimlikNo ? "tc" : "pasaport",
        document_no: (body.kimlikNo as string) || (body.pasaportNo as string) || null,
        birth_date: (body.dogumTarihi as string) || null,
      })
      .select("id")
      .single();
    if (guestErr) throw guestErr;
    await supabase.from("audit_logs").insert({
      branch_id: branchId,
      user_id: user.id,
      action: "checkin_create",
      entity: "guests",
      entity_id: (guest as { id?: string })?.id,
      meta_json: { odaId: body.odaId },
    });
    return new Response(
      JSON.stringify({
        success: true,
        message: "Check-in kaydedildi",
        guestId: (guest as { id?: string })?.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
