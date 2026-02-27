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
    const body = (await req.json().catch(() => ({}))) as { tesisAdi?: string };
    const tesisAdi = body.tesisAdi != null ? String(body.tesisAdi).trim() : null;
    if (!tesisAdi) {
      return new Response(JSON.stringify({ message: 'Tesis adı boş olamaz' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: profile } = await supabase.from('user_profiles').select('branch_id').eq('user_id', user.id).single();
    const branchId = (profile as { branch_id?: string })?.branch_id;
    if (!branchId) {
      return new Response(JSON.stringify({ message: 'Branch bulunamadı' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data, error } = await supabase.from('branches').update({ name: tesisAdi }).eq('id', branchId).select('id, name').single();
    if (error) throw error;
    return new Response(JSON.stringify({ message: 'Tesis bilgileri güncellendi', tesis: { id: data.id, tesisAdi: data.name } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown';
    return new Response(JSON.stringify({ message: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
