const express = require('express');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { encrypt } = require('../utils/kbsEncrypt');

const router = express.Router();

const ADMIN_SECRET = (process.env.ADMIN_SECRET || 'admin-secret-key').trim();

async function requireAdminPanelUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı' });
    }
    if (token === ADMIN_SECRET) {
      return next();
    }

    const looksLikeJwt = (token.match(/\./g)?.length ?? 0) >= 2;

    // JWT ise önce Supabase dene (Supabase JWT backend JWT ile verify edilmez)
    if (looksLikeJwt && supabaseAdmin) {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        const { data: profilesRow } = await supabaseAdmin.from('profiles').select('is_admin', 'role').eq('id', user.id).maybeSingle();
        if (profilesRow?.is_admin === true || (profilesRow?.role && ['admin', 'super_admin'].includes(profilesRow.role))) {
          req.user = user;
          req.adminSource = 'supabase';
          return next();
        }
        const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('user_id', user.id).maybeSingle();
        if (appRole?.role === 'admin') {
          req.user = user;
          req.adminSource = 'supabase';
          return next();
        }
        const { data: upProfiles } = await supabaseAdmin.from('user_profiles').select('role').eq('user_id', user.id).limit(5);
        const hasAdminProfile = Array.isArray(upProfiles) && upProfiles.some((p) => p.role === 'admin');
        if (hasAdminProfile) {
          req.user = user;
          req.adminSource = 'supabase';
          return next();
        }
      }
    }

    // Backend JWT (Prisma userId)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      if (userId != null) {
        const userIdStr = String(userId);
        const adminKullaniciIdRaw = process.env.ADMIN_KULLANICI_ID != null ? String(process.env.ADMIN_KULLANICI_ID).trim() : '';
        if (adminKullaniciIdRaw && adminKullaniciIdRaw === userIdStr) {
          req.adminSource = 'prisma';
          req.adminUserId = userIdStr;
          return next();
        }
        if (supabaseAdmin) {
          const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('backend_kullanici_id', userIdStr).maybeSingle();
          if (appRole?.role === 'admin') {
            req.adminSource = 'prisma';
            req.adminUserId = userIdStr;
            return next();
          }
        }
      }
    } catch (jwtErr) {
      const decoded = jwt.decode(token);
      const isBackendJwt = decoded && typeof decoded.userId !== 'undefined';
      if (isBackendJwt) {
        return res.status(401).json({
          message: 'Token gecersiz veya suresi dolmus. Yeniden giris yapin.',
        });
      }
    }

    if (looksLikeJwt && supabaseAdmin) {
      return res.status(403).json({ message: 'Bu alan sadece admin yetkili hesaplar için kullanılabilir' });
    }
    const looksLikePanelSecret = token.length > 8 && !looksLikeJwt;
    return res.status(401).json({
      message: looksLikePanelSecret
        ? 'Yetkisiz. Panel şifresi ile giriş yaptıysanız backend .env ADMIN_SECRET ile admin panel .env.local NEXT_PUBLIC_ADMIN_SECRET aynı olmalı.'
        : 'Yetkisiz',
    });
  } catch (err) {
    console.error('[appAdmin]', err);
    return res.status(500).json({ message: 'Yetkilendirme hatası' });
  }
}

router.use(requireAdminPanelUser);

/**
 * Dashboard istatistikleri (uygulama içi admin).
 * Her blok ayrı try/catch ile korunur; bir sorgu hata verse bile diğerleri döner.
 */
router.get('/dashboard', async (req, res) => {
  const out = {
    toplamTesis: 0,
    aktifTesis: 0,
    paketDagilimi: {},
    gunlukBildirim: 0,
    gunlukHata: 0,
    kotaAsimi: []
  };

  try {
    out.toplamTesis = await prisma.tesis.count();
  } catch (e) {
    console.error('App admin dashboard toplamTesis:', e?.message || e);
  }

  try {
    out.aktifTesis = await prisma.tesis.count({ where: { durum: 'aktif' } });
  } catch (e) {
    console.error('App admin dashboard aktifTesis:', e?.message || e);
  }

  try {
    const raw = await prisma.tesis.groupBy({
      by: ['paket'],
      _count: true,
      where: { durum: 'aktif' }
    });
    raw.forEach(p => { out.paketDagilimi[p.paket] = p._count; });
  } catch (e) {
    console.error('App admin dashboard paketDagilimi:', e?.message || e);
  }

  const bugun = new Date();
  bugun.setHours(0, 0, 0, 0);
  const yarin = new Date(bugun);
  yarin.setDate(yarin.getDate() + 1);

  try {
    out.gunlukBildirim = await prisma.bildirim.count({
      where: { createdAt: { gte: bugun, lt: yarin } }
    });
  } catch (e) {
    console.error('App admin dashboard gunlukBildirim:', e?.message || e);
  }

  try {
    out.gunlukHata = await prisma.bildirim.count({
      where: { createdAt: { gte: bugun, lt: yarin }, durum: 'hatali' }
    });
  } catch (e) {
    console.error('App admin dashboard gunlukHata:', e?.message || e);
  }

  try {
    const tesisler = await prisma.tesis.findMany({
      where: { durum: 'aktif' },
      select: { id: true, tesisAdi: true, paket: true, kota: true, kullanilanKota: true }
    });
    out.kotaAsimi = tesisler.filter(t => t.kullanilanKota != null && t.kota != null && t.kullanilanKota >= t.kota);
  } catch (e) {
    console.error('App admin dashboard kotaAsimi:', e?.message || e);
  }

  res.json(out);
});

/**
 * Destek taleplerini listele (admin panel — en yeniler üstte; anında yenileme için polling kullanılır)
 */
router.get('/support', async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tesis: { select: { id: true, tesisAdi: true } } },
    });
    res.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        tesisId: t.tesisId,
        tesisAdi: t.tesis?.tesisAdi ?? null,
        authorUserId: t.authorUserId,
        authorName: t.authorName,
        authorEmail: t.authorEmail,
        subject: t.subject,
        message: t.message,
        status: t.status,
        adminNote: t.adminNote,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (err) {
    console.error('[appAdmin] support list', err);
    res.status(500).json({ message: 'Destek talepleri alınamadı', error: err.message });
  }
});

/**
 * Tek destek talebi detayı (admin panel detay sayfası)
 */
router.get('/support/:id', async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: { tesis: { select: { id: true, tesisAdi: true } } },
    });
    if (!ticket) {
      return res.status(404).json({ message: 'Talep bulunamadı' });
    }
    res.json({
      ticket: {
        id: ticket.id,
        tesisId: ticket.tesisId,
        tesisAdi: ticket.tesis?.tesisAdi ?? null,
        authorUserId: ticket.authorUserId,
        authorName: ticket.authorName,
        authorEmail: ticket.authorEmail,
        subject: ticket.subject,
        message: ticket.message,
        status: ticket.status,
        adminNote: ticket.adminNote,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    });
  } catch (err) {
    console.error('[appAdmin] support get', err);
    res.status(500).json({ message: 'Talep alınamadı', error: err.message });
  }
});

/**
 * Destek talebini güncelle: status, adminNote. Kullanıcıya push bildirimi gönderir (authorUserId varsa).
 * PATCH /api/app-admin/support/:id — body: { status?: 'acik'|'isleme_alindi'|'cevaplandi'|'kapatildi', adminNote?: string }
 */
router.patch('/support/:id', express.json(), async (req, res) => {
  try {
    const { status, adminNote } = req.body || {};
    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) {
      return res.status(404).json({ message: 'Talep bulunamadı' });
    }
    const updates = {};
    if (typeof status === 'string' && ['acik', 'isleme_alindi', 'cevaplandi', 'kapatildi'].includes(status)) {
      updates.status = status;
    }
    if (typeof adminNote === 'string') {
      updates.adminNote = adminNote.trim().slice(0, 5000) || null;
    }
    if (Object.keys(updates).length === 0) {
      return res.json({ ticket: ticket, message: 'Değişiklik yok' });
    }
    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: updates,
    });

    // Kullanıcıya push: sorun çözüldü veya admin notu eklendi
    const authorUserId = updated.authorUserId;
    if (authorUserId && supabaseAdmin) {
      let title = 'Destek';
      let body = '';
      if (['cevaplandi', 'kapatildi'].includes(updated.status)) {
        body = updated.adminNote ? updated.adminNote.slice(0, 200) : 'Sorununuz çözüldü.';
        if (!updated.adminNote) title = 'Destek: Sorununuz çözüldü';
      } else if (updated.adminNote) {
        body = updated.adminNote.slice(0, 200);
        title = 'Destek notu';
      }
      if (body) {
        try {
          const { data: tokenRows } = await supabaseAdmin.from('user_push_tokens').select('token').eq('user_id', authorUserId);
          const tokens = (tokenRows || []).map((r) => r.token).filter(Boolean);
          if (tokens.length > 0) {
            const expoMessages = tokens.map((to) => ({ to, title, body, sound: 'default', data: { screen: 'Destek', ticketId: updated.id } }));
            const resExpo = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(expoMessages),
            });
            if (!resExpo.ok) {
              console.error('[appAdmin] support push failed', await resExpo.text());
            }
          }
        } catch (pushErr) {
          console.error('[appAdmin] support push', pushErr);
        }
      }
    }

    res.json({
      ticket: {
        id: updated.id,
        status: updated.status,
        adminNote: updated.adminNote,
        updatedAt: updated.updatedAt,
      },
      message: 'Talep güncellendi',
    });
  } catch (err) {
    console.error('[appAdmin] support patch', err);
    res.status(500).json({ message: 'Güncellenemedi', error: err.message });
  }
});

/**
 * KBS tesis bilgisi taleplerini listele (pending)
 */
router.get('/requests', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const status = req.query.status || 'pending';
    const { data, error } = await supabaseAdmin
      .from('facility_credentials_requests')
      .select('id, user_id, branch_id, backend_user_id, backend_tesis_id, tesis_kodu, action, status, created_at')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: 'Talepler alınamadı', error: error.message });
    res.json({ requests: data || [] });
  } catch (err) {
    console.error('[appAdmin] requests', err);
    res.status(500).json({ message: 'Talepler alınamadı', error: err.message });
  }
});

/**
 * Talebi onayla: create/update → facility_credentials upsert; delete → facility_credentials sil
 */
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('facility_credentials_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !row) return res.status(404).json({ message: 'Talep bulunamadı' });
    if (row.status !== 'pending') return res.status(400).json({ message: 'Talep zaten işlenmiş' });

    const reviewedBy = req.user?.id || null;

    if (row.action === 'delete') {
      if (row.backend_tesis_id != null && row.backend_user_id != null) {
        await supabaseAdmin.from('facility_credentials').delete().eq('backend_tesis_id', row.backend_tesis_id).eq('backend_user_id', row.backend_user_id);
      } else if (row.branch_id && row.user_id) {
        await supabaseAdmin.from('facility_credentials').delete().eq('branch_id', row.branch_id).eq('user_id', row.user_id);
      }
    } else {
      const enc = encrypt(row.web_servis_sifre);
      if (row.backend_tesis_id != null && row.backend_user_id != null) {
        const { data: existing } = await supabaseAdmin.from('facility_credentials').select('id').eq('backend_tesis_id', row.backend_tesis_id).eq('backend_user_id', row.backend_user_id).maybeSingle();
        const payload = {
          user_id: row.user_id,
          branch_id: row.branch_id,
          backend_user_id: row.backend_user_id,
          backend_tesis_id: row.backend_tesis_id,
          tesis_kodu: row.tesis_kodu,
          web_servis_sifre_enc: enc,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        if (existing) {
          const { error: upErr } = await supabaseAdmin.from('facility_credentials').update(payload).eq('id', existing.id);
          if (upErr) return res.status(500).json({ message: 'Onay kaydedilemedi', error: upErr.message });
        } else {
          const { error: inErr } = await supabaseAdmin.from('facility_credentials').insert(payload);
          if (inErr) return res.status(500).json({ message: 'Onay kaydedilemedi', error: inErr.message });
        }
      } else if (row.branch_id && row.user_id) {
        const { data: existing } = await supabaseAdmin.from('facility_credentials').select('id').eq('branch_id', row.branch_id).eq('user_id', row.user_id).maybeSingle();
        const payload = {
          user_id: row.user_id,
          branch_id: row.branch_id,
          backend_user_id: row.backend_user_id,
          backend_tesis_id: row.backend_tesis_id,
          tesis_kodu: row.tesis_kodu,
          web_servis_sifre_enc: enc,
          is_active: true,
          updated_at: new Date().toISOString(),
        };
        if (existing) {
          const { error: upErr } = await supabaseAdmin.from('facility_credentials').update(payload).eq('id', existing.id);
          if (upErr) return res.status(500).json({ message: 'Onay kaydedilemedi', error: upErr.message });
        } else {
          const { error: inErr } = await supabaseAdmin.from('facility_credentials').insert(payload);
          if (inErr) return res.status(500).json({ message: 'Onay kaydedilemedi', error: inErr.message });
        }
      }
    }

    const reviewedAt = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin.from('facility_credentials_requests').update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: reviewedAt,
    }).eq('id', id);
    if (updateErr) return res.status(500).json({ message: 'Talep güncellenemedi', error: updateErr.message });

    if (row.branch_id) {
      const { error: branchErr } = await supabaseAdmin.from('branches').update({
        kbs_approved: true,
        kbs_approved_at: reviewedAt,
        kbs_configured: true,
      }).eq('id', row.branch_id);
      if (branchErr) console.warn('[appAdmin] branches.kbs_approved güncellenemedi:', branchErr.message);
    }

    console.warn(`[REQ ${req.requestId || '-'}] KBS approve id=${id} branch_id=${row.branch_id || 'n/a'} reviewed_by=${reviewedBy} reviewed_at=${reviewedAt}`);

    res.json({ message: 'Talep onaylandı' });
  } catch (err) {
    console.error('[appAdmin] approve', err);
    res.status(500).json({ message: 'Onay işlemi başarısız', error: err.message });
  }
});

/**
 * Talebi reddet
 */
router.post('/requests/:id/reject', async (req, res) => {
  try {
    const id = req.params.id;
    const rejectReason = req.body?.reject_reason || null;
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });

    const { data: row } = await supabaseAdmin.from('facility_credentials_requests').select('id, status').eq('id', id).single();
    if (!row) return res.status(404).json({ message: 'Talep bulunamadı' });
    if (row.status !== 'pending') return res.status(400).json({ message: 'Talep zaten işlenmiş' });

    const reviewedBy = req.user?.id || null;
    const { error } = await supabaseAdmin.from('facility_credentials_requests').update({
      status: 'rejected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      reject_reason: rejectReason,
    }).eq('id', id);
    if (error) return res.status(500).json({ message: 'Talep güncellenemedi', error: error.message });
    res.json({ message: 'Talep reddedildi' });
  } catch (err) {
    console.error('[appAdmin] reject', err);
    res.status(500).json({ message: 'Red işlemi başarısız', error: err.message });
  }
});

// --- MVP: Admin API (vizyon dokümanına göre panel backend üzerinden çalışır) ---

/**
 * Admin audit log listesi — Supabase audit_logs tablosundan (tüm şubeler, merkez admin).
 */
router.get('/audit', async (req, res) => {
  try {
    const { action, target_user_id, limit = 100, offset = 0 } = req.query;
    const limitNum = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const offsetNum = Math.max(Number(offset) || 0, 0);

    if (!supabaseAdmin) {
      return res.json({ logs: [], total: 0 });
    }

    let query = supabaseAdmin
      .from('audit_logs')
      .select('id, branch_id, user_id, action, entity, entity_id, meta_json, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (action) query = query.eq('action', action);
    if (target_user_id) query = query.eq('user_id', target_user_id);

    const { data: logs, error, count } = await query;

    if (error) {
      console.error('[appAdmin] audit query', error.message);
      return res.status(500).json({ message: 'Audit log alınamadı', error: error.message });
    }
    res.json({ logs: logs || [], total: count ?? 0 });
  } catch (err) {
    console.error('[appAdmin] audit', err);
    res.status(500).json({ message: 'Audit log alınamadı', error: err.message });
  }
});

/**
 * Bekleyen kullanıcılar (user_profiles.approval_status = 'pending').
 * Supabase yoksa veya tablo/şema farklıysa boş liste döner (panel hata göstermesin).
 */
router.get('/pending-users', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.json({ users: [] });
    }
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, branch_id, role, display_name, approval_status, approved_at, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });
    if (profErr) {
      console.warn('[appAdmin] pending-users user_profiles:', profErr.message);
      return res.json({ users: [] });
    }
    const userIds = (profiles || []).map((p) => p.user_id);
    const usersMap = {};
    if (userIds.length > 0) {
      const { data: { users }, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (!usersErr && users) {
        users.forEach((u) => { usersMap[u.id] = u; });
      }
    }
    const list = (profiles || []).map((p) => {
      const u = usersMap[p.user_id];
      return {
        user_id: p.user_id,
        branch_id: p.branch_id,
        role: p.role,
        display_name: p.display_name,
        approval_status: p.approval_status,
        created_at: p.created_at,
        email: u?.email ?? null,
        phone: u?.phone ?? null,
        last_sign_in_at: u?.last_sign_in_at ?? null,
      };
    });
    res.json({ users: list });
  } catch (err) {
    console.error('[appAdmin] pending-users', err);
    res.json({ users: [] });
  }
});

/**
 * Kullanıcı listesi (Supabase auth.users + profiles; service role ile)
 */
router.get('/users', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 100, page: 1 });
    if (error) return res.status(500).json({ message: 'Kullanıcılar alınamadı', error: error.message });
    const list = (users || []).map((u) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));
    res.json({ users: list });
  } catch (err) {
    console.error('[appAdmin] users', err);
    res.status(500).json({ message: 'Kullanıcılar alınamadı', error: err.message });
  }
});

/**
 * Kullanıcı detay (auth + user_profiles)
 */
router.get('/users/:id', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(req.params.id);
    if (error || !user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('branch_id, role, display_name, approval_status, approved_at, approved_by, is_disabled, rejected_reason')
      .eq('user_id', req.params.id)
      .single();
    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profile || null,
    });
  } catch (err) {
    console.error('[appAdmin] user detail', err);
    res.status(500).json({ message: 'Kullanıcı bilgisi alınamadı', error: err.message });
  }
});

/**
 * Kullanıcıyı onayla (approval_status = approved)
 */
router.post('/users/:id/approve', async (req, res) => {
  try {
    const userId = req.params.id;
    const adminId = req.user?.id || req.adminUserId;
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: adminId || null,
        rejected_reason: null,
      })
      .eq('user_id', userId);
    if (error) return res.status(500).json({ message: 'Onay kaydedilemedi', error: error.message });
    res.json({ message: 'Kullanıcı onaylandı' });
  } catch (err) {
    console.error('[appAdmin] approve', err);
    res.status(500).json({ message: 'Onay işlemi başarısız', error: err.message });
  }
});

/**
 * Kullanıcıyı reddet (approval_status = rejected)
 */
router.post('/users/:id/reject', async (req, res) => {
  try {
    const userId = req.params.id;
    const reason = req.body?.reason || null;
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({
        approval_status: 'rejected',
        rejected_reason: reason,
      })
      .eq('user_id', userId);
    if (error) return res.status(500).json({ message: 'Red kaydedilemedi', error: error.message });
    res.json({ message: 'Kullanıcı reddedildi' });
  } catch (err) {
    console.error('[appAdmin] reject', err);
    res.status(500).json({ message: 'Red işlemi başarısız', error: err.message });
  }
});

/**
 * Kullanıcıyı dondur (MVP: profil bayrağı; ileride profiles.frozen veya user_status tablosu)
 */
router.post('/users/:id/freeze', async (req, res) => {
  try {
    const userId = req.params.id;
    const reason = req.body?.reason || null;
    const adminId = req.user?.id || req.adminUserId;
    // İleride: profiles veya user_status güncelle + admin_audit_log yaz
    console.log('[appAdmin] freeze', { userId, adminId, reason });
    res.json({ message: 'Kullanıcı donduruldu (MVP: kayıt hazır)' });
  } catch (err) {
    console.error('[appAdmin] freeze', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

/**
 * Kullanıcıyı devre dışı bırak (ban + user_profiles.is_disabled)
 */
router.post('/users/:id/disable', async (req, res) => {
  try {
    const userId = req.params.id;
    const reason = req.body?.reason || null;
    const adminId = req.user?.id || req.adminUserId;
    if (supabaseAdmin) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (authErr) return res.status(500).json({ message: 'Kullanıcı banlanamadı', error: authErr.message });
      const { error: profErr } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_disabled: true })
        .eq('user_id', userId);
      if (profErr) console.warn('[appAdmin] user_profiles.is_disabled güncellenemedi:', profErr.message);
    }
    console.log('[appAdmin] disable', { userId, adminId, reason });
    res.json({ message: 'Kullanıcı devre dışı bırakıldı' });
  } catch (err) {
    console.error('[appAdmin] disable', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

/**
 * Kullanıcı devre dışı bırakma kaldır (unban + user_profiles.is_disabled = false)
 */
router.post('/users/:id/enable', async (req, res) => {
  try {
    const userId = req.params.id;
    if (supabaseAdmin) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
      if (authErr) return res.status(500).json({ message: 'Ban kaldırılamadı', error: authErr.message });
      await supabaseAdmin
        .from('user_profiles')
        .update({ is_disabled: false })
        .eq('user_id', userId);
    }
    res.json({ message: 'Kullanıcı tekrar etkinleştirildi' });
  } catch (err) {
    console.error('[appAdmin] enable', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

/**
 * Tüm cihazlardan çıkış (force logout) — Supabase'de oturumları invalidate etmek için client tarafında token iptali gerekir; bu endpoint “flag” dönebilir.
 */
router.post('/users/:id/force-logout', async (req, res) => {
  try {
    const userId = req.params.id;
    const adminId = req.user?.id || req.adminUserId;
    // Supabase Auth Admin API'de tüm oturumları silmek için: updateUserById ile custom claim veya client'ın token'ı kontrol etmesi
    console.log('[appAdmin] force-logout', { userId, adminId });
    res.json({ message: 'Force logout talebi kaydedildi (client tarafında oturum iptali gerekir)' });
  } catch (err) {
    console.error('[appAdmin] force-logout', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

/**
 * Kullanıcıyı kalıcı sil (Supabase Auth deleteUser).
 */
router.post('/users/:id/delete', async (req, res) => {
  try {
    const userId = req.params.id;
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ message: 'Kullanıcı silinemedi', error: error.message });
    try {
      await supabaseAdmin.from('user_profiles').delete().eq('user_id', userId);
    } catch (e) {
      console.warn('[appAdmin] user_profiles delete', e?.message);
    }
    res.json({ message: 'Kullanıcı silindi' });
  } catch (err) {
    console.error('[appAdmin] users delete', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

// --- Tesis kullanıcıları (Prisma Kullanici: yetkiler, rol, giriş onayı) ---
const bcrypt = require('bcryptjs');

/**
 * GET /app-admin/tesis/:tesisId/kullanicilar — Tesisin backend kullanıcıları (adSoyad, yetkiler, rol, girisOnaylandi)
 */
router.get('/tesis/:tesisId/kullanicilar', async (req, res) => {
  try {
    const { tesisId } = req.params;
    const list = await prisma.kullanici.findMany({
      where: { tesisId },
      select: {
        id: true,
        adSoyad: true,
        telefon: true,
        email: true,
        rol: true,
        biyometriAktif: true,
        checkInYetki: true,
        odaDegistirmeYetki: true,
        bilgiDuzenlemeYetki: true,
        girisOnaylandi: true,
        girisTalepAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ kullanicilar: list });
  } catch (err) {
    console.error('[appAdmin] tesis kullanicilar', err);
    res.status(500).json({ message: 'Kullanıcılar alınamadı', error: err.message });
  }
});

/**
 * GET /app-admin/tesis/:tesisId/misafirler — Tesisin misafirleri (giriş tarihine göre sıralı; admin tanıma / e-posta atama için)
 */
router.get('/tesis/:tesisId/misafirler', async (req, res) => {
  try {
    const { tesisId } = req.params;
    const { cikisYapmis } = req.query;
    const where = { tesisId };
    if (cikisYapmis !== 'true') where.cikisTarihi = null;

    const misafirler = await prisma.misafir.findMany({
      where,
      include: {
        oda: { select: { id: true, odaNumarasi: true, odaTipi: true } },
      },
      orderBy: { girisTarihi: 'desc' },
    });
    res.json({ misafirler });
  } catch (err) {
    console.error('[appAdmin] tesis misafirler', err);
    res.status(500).json({ message: 'Misafirler alınamadı', error: err.message });
  }
});

/**
 * PATCH /app-admin/tesis/:tesisId/misafirler/:misafirId — Misafire e-posta ata (admin tarafından tanıma)
 */
router.patch('/tesis/:tesisId/misafirler/:misafirId', async (req, res) => {
  try {
    const { tesisId, misafirId } = req.params;
    const { email } = req.body;

    const misafir = await prisma.misafir.findFirst({
      where: { id: misafirId, tesisId },
    });
    if (!misafir) return res.status(404).json({ message: 'Misafir bulunamadı' });

    const newEmail = email !== undefined && email !== null && String(email).trim() !== ''
      ? String(email).trim()
      : null;
    await prisma.misafir.update({
      where: { id: misafirId },
      data: { email: newEmail },
    });
    res.json({ message: newEmail ? 'E-posta atandı' : 'E-posta kaldırıldı' });
  } catch (err) {
    console.error('[appAdmin] misafir email patch', err);
    res.status(500).json({ message: 'Güncelleme başarısız', error: err.message });
  }
});

/**
 * GET /app-admin/kullanicilar/:id — Tek Kullanıcı detay (PIN hash gösterilmez)
 */
router.get('/kullanicilar/:id', async (req, res) => {
  try {
    const k = await prisma.kullanici.findUnique({
      where: { id: req.params.id },
      include: { tesis: { select: { id: true, tesisAdi: true, tesisKodu: true, paket: true, trialEndsAt: true, createdAt: true } } },
    });
    if (!k) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    const { pin, sifre, ...rest } = k;
    res.json({ kullanici: { ...rest, hasPin: !!pin, hasSifre: !!sifre } });
  } catch (err) {
    console.error('[appAdmin] kullanici detail', err);
    res.status(500).json({ message: 'Kullanıcı alınamadı', error: err.message });
  }
});

/**
 * PATCH /app-admin/kullanicilar/:id — Yetkiler, rol, giriş onayı, adSoyad, telefon, email (PIN opsiyonel, hashlenir)
 */
router.patch('/kullanicilar/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const k = await prisma.kullanici.findUnique({ where: { id } });
    if (!k) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });

    const {
      adSoyad,
      telefon,
      email,
      rol,
      biyometriAktif,
      checkInYetki,
      odaDegistirmeYetki,
      bilgiDuzenlemeYetki,
      girisOnaylandi,
      pin,
    } = req.body;

    const data = {};
    if (adSoyad !== undefined) data.adSoyad = String(adSoyad).trim();
    if (telefon !== undefined) data.telefon = String(telefon).trim();
    if (email !== undefined) data.email = email === null || email === '' ? null : String(email).trim();
    if (rol !== undefined) data.rol = ['sahip', 'yonetici', 'resepsiyon'].includes(rol) ? rol : k.rol;
    if (typeof biyometriAktif === 'boolean') data.biyometriAktif = biyometriAktif;
    if (typeof checkInYetki === 'boolean') data.checkInYetki = checkInYetki;
    if (typeof odaDegistirmeYetki === 'boolean') data.odaDegistirmeYetki = odaDegistirmeYetki;
    if (typeof bilgiDuzenlemeYetki === 'boolean') data.bilgiDuzenlemeYetki = bilgiDuzenlemeYetki;
    if (typeof girisOnaylandi === 'boolean') data.girisOnaylandi = girisOnaylandi;
    if (pin !== undefined && pin !== null && String(pin).trim() !== '') {
      data.pin = await bcrypt.hash(String(pin).trim(), 10);
    }

    await prisma.kullanici.update({ where: { id }, data });
    res.json({ message: 'Kullanıcı güncellendi' });
  } catch (err) {
    console.error('[appAdmin] kullanici patch', err);
    res.status(500).json({ message: 'Güncelleme başarısız', error: err.message });
  }
});

// --- Satışlar (Siparişler) ---
const { getPackageCredits } = require('../config/packages');

/**
 * GET /app-admin/satislar — Tüm siparişler (filtre: durum, paket, tarih)
 */
router.get('/satislar', async (req, res) => {
  try {
    const { durum, paket, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (durum) where.durum = durum;
    if (paket) where.paket = paket;

    const [siparisler, total] = await Promise.all([
      prisma.siparis.findMany({
        where,
        include: { tesis: { select: { id: true, tesisAdi: true, tesisKodu: true, paket: true, kota: true } } },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10) || 100,
        skip: parseInt(offset, 10) || 0,
      }),
      prisma.siparis.count({ where }),
    ]);

    res.json({ siparisler, total });
  } catch (err) {
    console.error('[appAdmin] satislar', err);
    res.status(500).json({ message: 'Satışlar alınamadı', error: err.message });
  }
});

/**
 * POST /app-admin/satislar/:id/odendi — Ödeme alındı işaretle ve tesis paketini güncelle
 * Body: { adminNot?: string }
 */
router.post('/satislar/:id/odendi', async (req, res) => {
  try {
    const id = req.params.id;
    const adminNot = req.body?.adminNot || null;

    const siparis = await prisma.siparis.findUnique({ where: { id }, include: { tesis: true } });
    if (!siparis) return res.status(404).json({ message: 'Sipariş bulunamadı' });
    if (siparis.durum === 'odendi') return res.status(400).json({ message: 'Sipariş zaten ödendi' });
    if (siparis.durum === 'iptal') return res.status(400).json({ message: 'Sipariş iptal' });

    const kredi = getPackageCredits(siparis.paket);
    const now = new Date();

    await prisma.$transaction([
      prisma.siparis.update({
        where: { id },
        data: { durum: 'odendi', odemeAt: now, adminNot },
      }),
      prisma.tesis.update({
        where: { id: siparis.tesisId },
        data: {
          paket: siparis.paket,
          trialEndsAt: null,
          kota: kredi,
          kullanilanKota: 0,
        },
      }),
    ]);

    res.json({ message: 'Ödeme kaydedildi, paket tesisine atandı.', siparisNo: siparis.siparisNo });
  } catch (err) {
    console.error('[appAdmin] satislar odendi', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

/**
 * POST /app-admin/satislar/:id/iptal — Sipariş iptal (pending veya odendi).
 * Odendi ise: tesis kota/kullanilanKota, iptal edilen paket kredisi kadar düşürülür.
 */
router.post('/satislar/:id/iptal', async (req, res) => {
  try {
    const id = req.params.id;
    const siparis = await prisma.siparis.findUnique({ where: { id }, include: { tesis: true } });
    if (!siparis) return res.status(404).json({ message: 'Sipariş bulunamadı' });
    if (siparis.durum !== 'pending' && siparis.durum !== 'odendi') {
      return res.status(400).json({ message: 'Sadece bekleyen veya ödenmiş sipariş iptal edilebilir' });
    }

    const kredi = getPackageCredits(siparis.paket);

    if (siparis.durum === 'odendi' && siparis.tesisId && kredi > 0) {
      const tesis = siparis.tesis;
      const mevcutKota = tesis.kota ?? 0;
      const mevcutKullanilan = tesis.kullanilanKota ?? 0;
      const yeniKota = Math.max(0, mevcutKota - kredi);
      const yeniKullanilan = Math.min(mevcutKullanilan, yeniKota);

      await prisma.$transaction([
        prisma.siparis.update({ where: { id }, data: { durum: 'iptal' } }),
        prisma.tesis.update({
          where: { id: siparis.tesisId },
          data: {
            kota: yeniKota,
            kullanilanKota: yeniKullanilan,
            ...(yeniKota === 0 ? { paket: 'deneme' } : {}),
          },
        }),
      ]);
      return res.json({
        message: 'Sipariş iptal edildi. Tesis bildirim kotası ' + kredi + ' adet düşürüldü.',
        siparisNo: siparis.siparisNo,
        kotaDusurulen: kredi,
      });
    }

    await prisma.siparis.update({ where: { id }, data: { durum: 'iptal' } });
    res.json({ message: 'Sipariş iptal edildi', siparisNo: siparis.siparisNo });
  } catch (err) {
    console.error('[appAdmin] satislar iptal', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

router.requireAdminPanelUser = requireAdminPanelUser;
module.exports = router;
