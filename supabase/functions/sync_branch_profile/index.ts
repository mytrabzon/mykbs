/**
 * Backend'den çağrılır; service_role key sadece burada (Supabase içinde) kullanılır.
 * Authorization: Bearer SYNC_BRANCH_SECRET ile korunur.
 * Branch + user_profile oluşturur/günceller; backend'de service_role tutmaya gerek kalmaz.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NAMESPACE = 'mykbs-branch-v1';

async function tesisIdToBranchUuid(tesisId: string): Promise<string> {
  const data = new TextEncoder().encode(NAMESPACE + tesisId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return [
    hashHex.slice(0, 8),
    hashHex.slice(8, 12),
    hashHex.slice(12, 16),
    hashHex.slice(16, 20),
    hashHex.slice(20, 32),
  ].join('-');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const secret = Deno.env.get('SYNC_BRANCH_SECRET');
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/Bearer\s+/i, '')?.trim();
  if (!secret || token !== secret) {
    return new Response(JSON.stringify({ message: 'Yetkisiz' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: {
    supabase_user_id: string;
    tesis_id: string;
    tesis_adi: string;
    adres?: string | null;
    kullanici_rol?: string;
    ad_soyad?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: 'Geçersiz JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { supabase_user_id, tesis_id, tesis_adi, adres, kullanici_rol, ad_soyad } = body;
  if (!supabase_user_id || !tesis_id || !tesis_adi) {
    return new Response(JSON.stringify({ message: 'supabase_user_id, tesis_id, tesis_adi gerekli' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const branchId = await tesisIdToBranchUuid(tesis_id);

    let orgId: string | null = null;
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
    if (orgs && orgs.length > 0) {
      orgId = orgs[0].id;
    } else {
      const { data: newOrg, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: 'KBS Prime' })
        .select('id')
        .single();
      if (orgErr || !newOrg) {
        console.error('[sync_branch_profile] Organization oluşturulamadı', orgErr);
        return new Response(JSON.stringify({ message: 'Organization oluşturulamadı' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      orgId = newOrg.id;
    }

    await supabase.from('branches').upsert(
      {
        id: branchId,
        organization_id: orgId,
        name: tesis_adi || 'Tesis',
        address: adres ?? null,
      },
      { onConflict: 'id' }
    );

    const role = kullanici_rol === 'sahip' ? 'admin' : 'staff';
    const displayName = (ad_soyad && ad_soyad.trim()) || 'Kullanıcı';
    await supabase.from('user_profiles').upsert(
      {
        user_id: supabase_user_id,
        branch_id: branchId,
        role,
        display_name: displayName,
      },
      { onConflict: 'user_id' }
    );

    return new Response(JSON.stringify({ ok: true, branch_id: branchId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[sync_branch_profile] Hata:', e);
    return new Response(JSON.stringify({ message: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
