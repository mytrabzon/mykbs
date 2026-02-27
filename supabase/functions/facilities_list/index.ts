import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get('Authorization');
    // Test modu: backend detaylı log
    console.log('[facilities_list] istek', {
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader ? authHeader.length : 0,
    });
    if (!authHeader) {
      console.log('[facilities_list] hata: Authorization header yok');
      return new Response(JSON.stringify({ message: 'Yetkisiz' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: getUserError } = await supabase.auth.getUser();
    console.log('[facilities_list] getUser', {
      hasUser: !!user,
      userId: user?.id ?? null,
      getUserError: getUserError?.message ?? null,
    });
    if (!user) {
      console.log('[facilities_list] hata: Yetkisiz (user yok veya token geçersiz)');
      return new Response(JSON.stringify({ message: 'Yetkisiz' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: profile } = await supabase.from('user_profiles').select('branch_id').eq('user_id', user.id).single();
    const branchId = profile?.branch_id;
    console.log('[facilities_list] profile', { branchId: branchId ?? null, hasProfile: !!profile });
    if (!branchId) {
      console.log('[facilities_list] hata: Branch bulunamadı');
      return new Response(JSON.stringify({ message: 'Branch bulunamadı' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let branch: Record<string, unknown> | null = null;
    const fullSelect = await supabase.from('branches').select('id, name, organization_id, address, latitude, longitude, kbs_configured').eq('id', branchId).single();
    if (fullSelect.data) branch = fullSelect.data as Record<string, unknown>;
    if (!branch) {
      const baseSelect = await supabase.from('branches').select('id, name, organization_id, address').eq('id', branchId).single();
      branch = baseSelect.data as Record<string, unknown> | null;
    }
    const br = branch;
    const kbsConfigured = br && typeof br.kbs_configured === 'boolean' ? br.kbs_configured : false;
    const { data: org } = br?.organization_id
      ? await supabase.from('organizations').select('id, name').eq('id', br.organization_id).single()
      : { data: null };
    const tesis = {
      id: br?.id,
      tesisAdi: (br?.name as string) || 'Tesis',
      paket: 'standard',
      kota: 100,
      kullanilanKota: 0,
      kbsTuru: 'polis',
      kbsConnected: kbsConfigured,
      address: typeof br?.address === 'string' ? br.address : undefined,
      latitude: typeof br?.latitude === 'number' ? br.latitude : undefined,
      longitude: typeof br?.longitude === 'number' ? br.longitude : undefined,
      organization: org,
    };
    const ozet = {
      toplamOda: 0,
      doluOda: 0,
      bugunGiris: 0,
      bugunCikis: 0,
      hataliBildirim: 0,
    };
    console.log('[facilities_list] başarılı', { branchId });
    return new Response(JSON.stringify({ tesis, ozet }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[facilities_list] exception', e?.message ?? e);
    return new Response(JSON.stringify({ message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
