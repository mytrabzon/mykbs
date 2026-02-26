import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[rooms_list] istek', { hasAuthHeader: !!authHeader, authHeaderLength: authHeader ? authHeader.length : 0 });
    if (!authHeader) {
      console.log('[rooms_list] hata: Authorization header yok');
      return new Response(JSON.stringify({ message: 'Yetkisiz' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    console.log('[rooms_list] getUser', { hasUser: !!user, userId: user?.id ?? null, getUserError: getUserError?.message ?? null });
    if (!user) {
      console.log('[rooms_list] hata: Oturum geçersiz');
      return new Response(JSON.stringify({ message: 'Oturum geçersiz' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = await req.json().catch(() => ({}));
    const filtre = (body && (body as any).filtre) || 'tumu';
    const { data: profile } = await supabase.from('user_profiles').select('branch_id').eq('user_id', user.id).single();
    const branchId = (profile as any)?.branch_id;
    console.log('[rooms_list] profile', { branchId: branchId ?? null, filtre });
    if (!branchId) {
      console.log('[rooms_list] hata: Branch bulunamadı');
      return new Response(JSON.stringify({ message: 'Branch bulunamadı' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: rooms } = await supabase.from('guests').select('id, full_name, document_no, created_at').eq('branch_id', branchId);
    const odalar = (rooms || []).map((g: any, i: number) => {
      const hasGuest = !!g;
      return {
        id: g.id,
        odaNumarasi: String(100 + i),
        odaTipi: 'Standart Oda',
        kapasite: 2,
        durum: hasGuest ? 'dolu' : 'bos',
        odadaMi: hasGuest,
        misafir: hasGuest ? { id: g.id, ad: (g.full_name || '').split(' ')[0] || '', soyad: (g.full_name || '').split(' ').slice(1).join(' ') || '', girisTarihi: g.created_at } : undefined,
      };
    });
    console.log('[rooms_list] başarılı', { branchId, odalarCount: (rooms || []).length });
    return new Response(JSON.stringify({ odalar }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[rooms_list] exception', e?.message ?? e);
    return new Response(JSON.stringify({ message: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
