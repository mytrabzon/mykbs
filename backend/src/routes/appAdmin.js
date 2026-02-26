/**
 * Uygulama içi admin paneli: Sadece belirli Supabase UID ile erişilir.
 * Authorization: Bearer <supabase_access_token>
 */
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { supabaseAdmin } = require('../lib/supabaseAdmin');

const router = express.Router();
const prisma = new PrismaClient();

const ADMIN_PANEL_USER_UID = process.env.ADMIN_PANEL_USER_UID || 'f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7';

async function requireAdminPanelUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ message: 'Token bulunamadı' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
    }
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ message: 'Oturum geçersiz veya süresi dolmuş' });
    }
    if (user.id !== ADMIN_PANEL_USER_UID) {
      return res.status(403).json({ message: 'Bu alan sadece yetkili hesap için kullanılabilir' });
    }
    req.user = user;
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

module.exports = router;
