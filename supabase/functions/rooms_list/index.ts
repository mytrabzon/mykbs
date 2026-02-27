import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STEP = { AUTH_HEADER: 'ROOMS_AUTH_HEADER', USER: 'ROOMS_USER', BODY: 'ROOMS_BODY', PROFILE: 'ROOMS_PROFILE', GUESTS_QUERY: 'ROOMS_GUESTS_QUERY', MAP: 'ROOMS_MAP', UNKNOWN: 'ROOMS_UNKNOWN' };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    console.log('[rooms_list] step=AUTH_HEADER', { hasAuthHeader: !!authHeader, authHeaderLength: authHeader ? authHeader.length : 0 });
    if (!authHeader) {
      console.log('[rooms_list] hata', { step: STEP.AUTH_HEADER, reason: 'Authorization header yok' });
      return new Response(JSON.stringify({ message: 'Yetkisiz. Giriş yapın.', code: STEP.AUTH_HEADER }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    console.log('[rooms_list] step=USER', { hasUser: !!user, userId: user?.id ?? null, error: getUserError?.message ?? null });
    if (!user) {
      console.log('[rooms_list] hata', { step: STEP.USER, reason: 'Kullanıcı bulunamadı', getUserError: getUserError?.message });
      return new Response(JSON.stringify({ message: 'Yetkisiz. Oturum geçersiz.', code: STEP.USER }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json().catch(() => ({}));
    const filtre = (body && (body as any).filtre) || 'tumu';
    console.log('[rooms_list] step=BODY', { filtre });

    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('branch_id').eq('user_id', user.id).single();
    const branchId = (profile as any)?.branch_id;
    console.log('[rooms_list] step=PROFILE', { branchId: branchId ?? null, profileError: profileError?.message ?? null });
    if (!branchId) {
      console.log('[rooms_list] hata', { step: STEP.PROFILE, reason: 'Branch bulunamadı', profileError: profileError?.message });
      return new Response(JSON.stringify({ message: 'Şubeniz bulunamadı. Yöneticiye bildirin.', code: STEP.PROFILE }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[rooms_list] step=GUESTS_QUERY', { branchId });
    const { data: rooms, error: guestsError } = await supabase.from('guests').select('id, full_name, document_no, created_at').eq('branch_id', branchId);
    if (guestsError) {
      console.error('[rooms_list] hata', { step: STEP.GUESTS_QUERY, reason: guestsError.message, code: guestsError.code });
      return new Response(JSON.stringify({ message: `Oda listesi alınamadı: ${guestsError.message}`, code: STEP.GUESTS_QUERY }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('[rooms_list] step=MAP', { guestsCount: (rooms || []).length });
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
    console.log('[rooms_list] başarılı', { step: 'ROOMS_OK', branchId, odalarCount: odalar.length });
    return new Response(JSON.stringify({ odalar }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[rooms_list] exception', { step: STEP.UNKNOWN, message: e?.message ?? e, stack: e?.stack?.slice(0, 500) });
    return new Response(JSON.stringify({ message: e?.message ?? 'Beklenmeyen hata', code: STEP.UNKNOWN }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
