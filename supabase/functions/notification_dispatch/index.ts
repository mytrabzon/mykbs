import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows } = await supabase.from("notifications").select("id, branch_id, payload_json").eq("status", "queued").limit(10);
    for (const row of rows || []) {
      try {
        const institutionUrl = Deno.env.get("KBS_INSTITUTION_ENDPOINT");
        if (!institutionUrl) {
          await supabase.from("notifications").update({ status: "failed", last_error: "KBS_INSTITUTION_ENDPOINT not set" }).eq("id", row.id);
          continue;
        }
        const res = await fetch(institutionUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row.payload_json) });
        if (res.ok) {
          await supabase.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id);
        } else {
          await supabase.from("notifications").update({ status: "failed", last_error: await res.text() }).eq("id", row.id);
        }
      } catch (e: any) {
        await supabase.from("notifications").update({ status: "failed", last_error: e.message }).eq("id", row.id);
      }
    }
    return new Response(JSON.stringify({ processed: (rows || []).length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
