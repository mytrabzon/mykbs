import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ message: 'Yetkisiz' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const u = await supabase.auth.getUser();
    if (!u.data.user) return new Response(JSON.stringify({ message: 'Oturum gecersiz' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const body = await req.json().catch(() => ({}));
    const profile = await supabase.from('user_profiles').select('branch_id').eq('user_id', u.data.user.id).single();
    const branchId = profile.data?.branch_id;
    if (!branchId) return new Response(JSON.stringify({ message: 'Branch bulunamadi' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const ins = await supabase.from('notifications').insert({ branch_id: branchId, payload_json: body || {}, status: 'queued' }).select('id, status').single();
    if (ins.error) throw ins.error;
    await supabase.from('audit_logs').insert({ branch_id: branchId, user_id: u.data.user.id, action: 'notification_submit', entity: 'notifications', entity_id: ins.data?.id, meta_json: {} });
    return new Response(JSON.stringify({ notification_id: ins.data?.id, status: 'queued' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
