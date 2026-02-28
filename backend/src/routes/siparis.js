/**
 * Paket siparişi: mobil "Satın Al" ile oluşturulur; admin panelde ödeme alındı + paket atanır.
 * Auth: Supabase (mobil) veya legacy JWT.
 */
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { ensureTesisForBranch } = require('../lib/ensureTesisForBranch');
const { getPackageCredits, PACKAGES } = require('../config/packages');

const router = express.Router();
const prisma = new PrismaClient();

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis?.id;
}

/** Okunabilir sipariş no: ORD-YYYYMMDD-XXX (günlük sıra) */
async function generateSiparisNo() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `ORD-${today}-`;
  const existing = await prisma.siparis.findMany({
    where: { siparisNo: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  const next = existing.length ? parseInt((existing[0].siparisNo || '').split('-')[2] || '0', 10) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

/**
 * POST /api/siparis — Sipariş oluştur (giriş yapmış tesis kullanıcısı)
 * Body: { paket: 'starter' | 'pro' | 'business' | 'enterprise' }
 */
router.post('/', authenticateTesisOrSupabase, async (req, res) => {
  try {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }
    const tesisId = getTesisId(req);
    if (!tesisId) return res.status(403).json({ message: 'Tesis bilgisi bulunamadı' });

    const { paket } = req.body;
    const valid = ['starter', 'pro', 'business', 'enterprise'];
    if (!paket || !valid.includes(paket)) {
      return res.status(400).json({ message: 'Geçerli paket seçiniz: starter, pro, business, enterprise' });
    }

    const pkg = PACKAGES[paket];
    if (!pkg) return res.status(400).json({ message: 'Paket bulunamadı' });

    const siparisNo = await generateSiparisNo();
    const siparis = await prisma.siparis.create({
      data: {
        siparisNo,
        tesisId,
        paket,
        tutarTL: pkg.priceTL,
        kredi: pkg.credits,
        durum: 'pending',
      },
    });

    res.status(201).json({
      message: 'Siparişiniz alındı. Ödeme bilgisi e-posta veya SMS ile iletilecektir.',
      siparisNo: siparis.siparisNo,
      siparisId: siparis.id,
      paket: siparis.paket,
      tutarTL: siparis.tutarTL,
      kredi: siparis.kredi,
      durum: siparis.durum,
    });
  } catch (err) {
    console.error('[siparis] create', err);
    res.status(500).json({ message: 'Sipariş oluşturulamadı', error: err.message });
  }
});

/**
 * GET /api/siparis — Giriş yapan tesisin siparişleri
 */
router.get('/', authenticateTesisOrSupabase, async (req, res) => {
  try {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }
    const tesisId = getTesisId(req);
    if (!tesisId) return res.status(403).json({ message: 'Tesis bilgisi bulunamadı' });

    const list = await prisma.siparis.findMany({
      where: { tesisId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ siparisler: list });
  } catch (err) {
    console.error('[siparis] list', err);
    res.status(500).json({ message: 'Siparişler alınamadı', error: err.message });
  }
});

module.exports = router;
