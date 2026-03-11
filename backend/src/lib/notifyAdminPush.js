/**
 * Admin push bildirimi: Supabase notification_outbox'a kayıt ekler ve push_dispatch'i tetikler.
 * Böylece admin/moderator rolündeki ve mobilde push token kayıtlı kullanıcılara anında push gider.
 * Kullanım: destek talebi açıldığında, onay bekleyen yeni kayıt, vb.
 */
const { supabaseAdmin } = require('./supabaseAdmin');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Supabase'deki admin/moderator kullanıcı ID'lerini döndürür (user_profiles + profiles).
 * @returns {Promise<string[]>} UUID dizisi
 */
async function getAdminUserIds() {
  if (!supabaseAdmin) return [];
  const ids = new Set();

  const { data: profileRows } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .in('role', ['admin', 'moderator']);
  for (const row of profileRows || []) {
    if (row?.user_id) ids.add(row.user_id);
  }

  try {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('is_admin', true);
    for (const row of profiles || []) {
      if (row?.id) ids.add(row.id);
    }
  } catch (_) {
    // profiles tablosu yoksa veya farklı yapıdaysa atla
  }

  return [...ids];
}

/**
 * notification_outbox için bir branch_id döndürür (NOT NULL zorunluluğu için).
 * @returns {Promise<string|null>}
 */
async function getOneBranchId() {
  if (!supabaseAdmin) return null;
  const { data: rows } = await supabaseAdmin.from('branches').select('id').limit(1);
  return rows?.[0]?.id ?? null;
}

/**
 * Admin push bildirimi gönderir: outbox'a ekler ve push_dispatch Edge'ini çağırır.
 * @param {Object} opts
 * @param {string} opts.title - Bildirim başlığı
 * @param {string} opts.body - Bildirim metni
 * @param {Record<string, unknown>} [opts.data] - Ek veri (type, ticketId, vb.)
 * @returns {Promise<{ ok: boolean, outboxId?: string, error?: string }>}
 */
async function notifyAdminPush({ title, body, data = {} }) {
  if (!supabaseAdmin || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[notifyAdminPush] Supabase yapılandırması eksik');
    return { ok: false, error: 'Supabase yapılandırması eksik' };
  }

  const adminIds = await getAdminUserIds();
  if (adminIds.length === 0) {
    return { ok: true, note: 'Hedef admin yok' };
  }

  const branchId = await getOneBranchId();
  if (!branchId) {
    console.warn('[notifyAdminPush] branches tablosunda kayıt yok, outbox atlandı');
    return { ok: false, error: 'branch_id yok' };
  }

  const payload = {
    title: title || 'KBS Bildirim',
    body: body || '',
    data: data && typeof data === 'object' ? data : {},
  };

  const { data: outboxRow, error: insertErr } = await supabaseAdmin
    .from('notification_outbox')
    .insert({
      branch_id: branchId,
      target_user_ids: adminIds,
      payload,
      status: 'queued',
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[notifyAdminPush] outbox insert', insertErr);
    return { ok: false, error: insertErr.message };
  }

  const outboxId = outboxRow?.id;
  try {
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/push_dispatch`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const text = await res.text();
    if (!res.ok) {
      console.warn('[notifyAdminPush] push_dispatch çağrısı başarısız', res.status, text);
      return { ok: true, outboxId, note: 'Outbox eklendi, push_dispatch yanıt hatası' };
    }
    return { ok: true, outboxId };
  } catch (e) {
    console.warn('[notifyAdminPush] push_dispatch fetch', e?.message);
    return { ok: true, outboxId, note: 'Outbox eklendi, push_dispatch çağrılamadı' };
  }
}

module.exports = { notifyAdminPush, getAdminUserIds, getOneBranchId };
