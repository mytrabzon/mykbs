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
    const { data: profile } = await supabase.from('user_profiles').select('branch_id').eq('user_id', user.id).single();
    const branchId = (profile as { branch_id?: string })?.branch_id;
    if (!branchId) {
      return new Response(JSON.stringify({ kbsTuru: null, kbsTesisKodu: '', kbsWebServisSifre: '', ipKisitAktif: false }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: branch } = await supabase.from('branches').select('kbs_turu, kbs_tesis_kodu').eq('id', branchId).single();
    const b = (branch || {}) as { kbs_turu?: string; kbs_tesis_kodu?: string };
    // KBS şifresi istemciye gönderilmez; KBS işlemleri sadece sunucu tarafında yapılmalı
    return new Response(JSON.stringify({
      kbsTuru: b.kbs_turu ?? null,
      kbsTesisKodu: b.kbs_tesis_kodu ?? '',
      kbsWebServisSifre: '',
      ipKisitAktif: false,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    return new Response(JSON.stringify({ message: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
