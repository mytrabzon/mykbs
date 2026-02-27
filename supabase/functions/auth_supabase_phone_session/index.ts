import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as { access_token?: string };
    const authHeader = req.headers.get("Authorization");
    const accessToken = body.access_token || authHeader?.replace(/Bearer\s+/i, "");

    if (!accessToken) {
      return new Response(
        JSON.stringify({ message: "access_token gerekli" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await userClient.auth.getUser(accessToken);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ message: "Yetkisiz" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    let profile = await admin.from("user_profiles").select("branch_id, role, display_name").eq("user_id", user.id).single().then((r) => r.data);
    let branchId = profile?.branch_id;

    if (!branchId) {
      const orgRes = await admin.from("organizations").insert({ name: "Tesisim" }).select("id").single();
      const orgId = (orgRes.data as { id?: string } | null)?.id;
      if (!orgId) {
        return new Response(
          JSON.stringify({ message: "Organizasyon oluşturulamadı" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const branchRes = await admin.from("branches").insert({ organization_id: orgId, name: "Ana Tesis" }).select("id").single();
      const newBranchId = (branchRes.data as { id?: string } | null)?.id;
      if (!newBranchId) {
        return new Response(
          JSON.stringify({ message: "Tesis oluşturulamadı" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    return new Response(
      JSON.stringify({
        token: accessToken,
        kullanici,
        tesis,
        supabaseAccessToken: accessToken,
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
