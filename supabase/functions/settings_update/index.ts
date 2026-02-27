import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ message: 'Yetkisiz' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ message: 'Yetkisiz' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { data: profile } = await supabase.from('user_profiles').select('branch_id').eq('user_id', user.id).single();
    const branchId = (profile as { branch_id?: string })?.branch_id;
    if (!branchId) {
      return new Response(JSON.stringify({ message: 'Branch bulunamadı' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: current } = await supabase.from('branches').select('kbs_turu, kbs_tesis_kodu, kbs_web_servis_sifre').eq('id', branchId).single();
    const cur = (current || {}) as { kbs_turu?: string | null; kbs_tesis_kodu?: string | null; kbs_web_servis_sifre?: string | null };
    const kbsTuru = body.kbsTuru !== undefined ? (body.kbsTuru === '' ? null : body.kbsTuru) : cur.kbs_turu;
    const kbsTesisKodu = body.kbsTesisKodu !== undefined ? (body.kbsTesisKodu === '' ? null : body.kbsTesisKodu) : cur.kbs_tesis_kodu;
    const kbsWebServisSifre = body.kbsWebServisSifre !== undefined ? (body.kbsWebServisSifre === '' ? null : body.kbsWebServisSifre) : cur.kbs_web_servis_sifre;
    const update: Record<string, unknown> = {
      kbs_turu: kbsTuru,
      kbs_tesis_kodu: kbsTesisKodu,
      kbs_web_servis_sifre: kbsWebServisSifre,
      kbs_configured: !!(kbsTuru && kbsTesisKodu && kbsWebServisSifre),
    };
    const { error } = await supabase.from('branches').update(update).eq('id', branchId);
    if (error) throw error;
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    return new Response(JSON.stringify({ message: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
