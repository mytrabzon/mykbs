/**
 * Uygulama içi admin paneli: Supabase admin veya backend JWT + role admin.
 * Authorization: Bearer <supabase_access_token | backend_jwt>
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { encrypt } = require('../utils/kbsEncrypt');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-key';

async function requireAdminPanelUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı' });
    }

    // 0) Admin şifre ile giriş (panel tüm sayfaları tek token ile kullanılabilsin)
    if (token === ADMIN_SECRET) {
      return next();
    }

    // 1) Önce backend JWT dene (Prisma userId)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      if (userId != null) {
        const adminKullaniciId = process.env.ADMIN_KULLANICI_ID != null ? Number(process.env.ADMIN_KULLANICI_ID) : null;
        if (adminKullaniciId != null && adminKullaniciId === userId) {
          req.adminSource = 'prisma';
          req.adminUserId = userId;
          return next();
        }
        if (supabaseAdmin) {
          const { data: appRole } = await supabaseAdmin.from('app_roles').select('role').eq('backend_kullanici_id', userId).maybeSingle();
          if (appRole?.role === 'admin') {
            req.adminSource = 'prisma';
            req.adminUserId = userId;
            return next();
          }
        }
      }
    } catch (_) { /* not a backend JWT */ }

    // 2) Supabase token
    if (!supabaseAdmin) {
      return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ message: 'Yetkisiz' });
    }
    const { data: profilesRow } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (profilesRow?.is_admin === true) {
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
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    if (profileError || !profile || profile.role !== 'admin') {
      return res.status(403).json({ message: 'Bu alan sadece admin yetkili hesaplar için kullanılabilir' });
    }
    req.user = user;
    req.adminSource = 'supabase';
    next();
  } catch (err) {
    console.error('[appAdmin]', err);
    return res.status(500).json({ message: 'Yetkilendirme hatası' });
  }
}

router.use(requireAdminPanelUser);

/**
 * Dashboard istatistikleri (uygulama içi admin)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const toplamTesis = await prisma.tesis.count();
    const aktifTesis = await prisma.tesis.count({ where: { durum: 'aktif' } });

    let paketDagilimi = {};
    try {
      const raw = await prisma.tesis.groupBy({
        by: ['paket'],
        _count: true,
        where: { durum: 'aktif' }
      });
      raw.forEach(p => { paketDagilimi[p.paket] = p._count; });
    } catch (_) {
      // Prisma schema'da paket/durum yoksa boş bırak
    }

    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const yarin = new Date(bugun);
    yarin.setDate(yarin.getDate() + 1);

    let gunlukBildirim = 0;
    let gunlukHata = 0;
    let kotaAsimi = [];
    try {
      gunlukBildirim = await prisma.bildirim.count({
        where: { createdAt: { gte: bugun, lt: yarin } }
      });
    } catch (_) {}
    try {
      gunlukHata = await prisma.bildirim.count({
        where: {
          createdAt: { gte: bugun, lt: yarin },
          durum: 'hatali'
        }
      });
    } catch (_) {}
    try {
      const tesisler = await prisma.tesis.findMany({
        where: { durum: 'aktif' },
        select: {
          id: true,
          tesisAdi: true,
          paket: true,
          kota: true,
          kullanilanKota: true
        }
      });
      kotaAsimi = tesisler.filter(t => t.kullanilanKota != null && t.kota != null && t.kullanilanKota >= t.kota);
    } catch (_) {}

    res.json({
      toplamTesis,
      aktifTesis,
      paketDagilimi,
      gunlukBildirim,
      gunlukHata,
      kotaAsimi
    });
  } catch (error) {
    console.error('App admin dashboard hatası:', error);
    res.status(500).json({ message: 'Dashboard verileri alınamadı', error: error.message });
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
 * Admin audit log listesi (MVP: boş veya ileride admin_audit_log tablosundan)
 */
router.get('/audit', async (req, res) => {
  try {
    const { action, target_user_id, limit = 100, offset = 0 } = req.query;
    // İleride: Supabase admin_audit_log veya Prisma AdminAuditLog
    const logs = [];
    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('[appAdmin] audit', err);
    res.status(500).json({ message: 'Audit log alınamadı', error: err.message });
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
 * Kullanıcı detay (MVP: temel bilgi)
 */
router.get('/users/:id', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(req.params.id);
    if (error || !user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    res.json({
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    });
  } catch (err) {
    console.error('[appAdmin] user detail', err);
    res.status(500).json({ message: 'Kullanıcı bilgisi alınamadı', error: err.message });
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
 * Kullanıcıyı devre dışı bırak (ban)
 */
router.post('/users/:id/disable', async (req, res) => {
  try {
    const userId = req.params.id;
    const reason = req.body?.reason || null;
    const adminId = req.user?.id || req.adminUserId;
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
      if (error) return res.status(500).json({ message: 'Kullanıcı banlanamadı', error: error.message });
    }
    console.log('[appAdmin] disable', { userId, adminId, reason });
    res.json({ message: 'Kullanıcı devre dışı bırakıldı' });
  } catch (err) {
    console.error('[appAdmin] disable', err);
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
 * POST /app-admin/satislar/:id/iptal — Sipariş iptal
 */
router.post('/satislar/:id/iptal', async (req, res) => {
  try {
    const id = req.params.id;
    const siparis = await prisma.siparis.findUnique({ where: { id } });
    if (!siparis) return res.status(404).json({ message: 'Sipariş bulunamadı' });
    if (siparis.durum !== 'pending') return res.status(400).json({ message: 'Sadece bekleyen sipariş iptal edilebilir' });

    await prisma.siparis.update({ where: { id }, data: { durum: 'iptal' } });
    res.json({ message: 'Sipariş iptal edildi', siparisNo: siparis.siparisNo });
  } catch (err) {
    console.error('[appAdmin] satislar iptal', err);
    res.status(500).json({ message: 'İşlem başarısız', error: err.message });
  }
});

router.requireAdminPanelUser = requireAdminPanelUser;
module.exports = router;
