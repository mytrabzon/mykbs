/**
 * Backend tesis/kullanıcı ile Supabase branches + user_profiles senkronizasyonu.
 * Service role key backend'de TUTULMAZ: sync_branch_profile Edge Function çağrılır,
 * secret (SYNC_BRANCH_SECRET) ile yetkilendirilir. Service role sadece Supabase içinde kullanılır.
 */
const SYNC_BRANCH_SECRET = process.env.SYNC_BRANCH_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;

/**
 * Supabase'de bu tesis için branch ve bu kullanıcı için user_profile var mı emin olur.
 * Edge Function sync_branch_profile'ı çağırır (service_role backend'de yok).
 *
 * @param {string} supabaseUserId - auth.users.id (Supabase Auth)
 * @param {object} kullanici - Prisma Kullanici ({ id, adSoyad, rol, ... })
 * @param {object} tesis - Prisma Tesis ({ id, tesisAdi, adres, ... })
 * @returns {Promise<void>}
 */
async function ensureSupabaseBranchAndProfile(supabaseUserId, kullanici, tesis) {
  if (!SYNC_BRANCH_SECRET || !SUPABASE_URL) {
    console.warn('[supabaseSync] SYNC_BRANCH_SECRET veya SUPABASE_URL yok, sync atlanıyor');
    return;
  }
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/sync_branch_profile`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SYNC_BRANCH_SECRET}`,
      },
      body: JSON.stringify({
        supabase_user_id: supabaseUserId,
        tesis_id: tesis.id,
        tesis_adi: tesis.tesisAdi || 'Tesis',
        adres: tesis.adres ?? null,
        kullanici_rol: kullanici.rol,
        ad_soyad: kullanici.adSoyad,
      }),
    });
    if (res.ok) {
      console.log('[supabaseSync] Branch/profile sync tamamlandı');
    } else {
      const text = await res.text();
      console.error('[supabaseSync] Edge Function hata', res.status, text);
    }
  } catch (err) {
    console.error('[supabaseSync] Hata:', err.message);
  }
}

module.exports = { ensureSupabaseBranchAndProfile };
