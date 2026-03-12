/**
 * Paket siparişi: mobil "Satın Al" ile oluşturulur; admin panelde ödeme alındı + paket atanır.
 * Auth: Supabase (mobil) veya legacy JWT.
 */
const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { ensureTesisForBranch } = require('../lib/ensureTesisForBranch');
const { PACKAGES } = require('../config/packages');
const { productIdToPaket } = require('../config/iapProducts');
const { verifyAppleReceipt, verifyGooglePurchase } = require('../services/iapVerify');

const router = express.Router();

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
        tutarTL: Math.round(pkg.priceTL),
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
 * GET /api/siparis — Giriş yapan tesisin siparişleri + kredi/harcama özeti
 */
router.get('/', authenticateTesisOrSupabase, async (req, res) => {
  try {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }
    const tesisId = getTesisId(req);
    if (!tesisId) return res.status(403).json({ message: 'Tesis bilgisi bulunamadı' });

    const [list, tesis, odendiToplam] = await Promise.all([
      prisma.siparis.findMany({
        where: { tesisId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.tesis.findUnique({
        where: { id: tesisId },
        select: { kota: true, kullanilanKota: true, paket: true },
      }),
      prisma.siparis.aggregate({
        where: { tesisId, durum: 'odendi' },
        _sum: { tutarTL: true },
        _count: true,
      }),
    ]);

    const toplamKota = tesis?.kota ?? 0;
    const kullanilanKredi = tesis?.kullanilanKota ?? 0;
    const kalanKredi = Math.max(0, toplamKota - kullanilanKredi);
    const toplamHarcamaTL = odendiToplam._sum.tutarTL ?? 0;

    res.json({
      siparisler: list,
      ozet: {
        kalanKredi,
        kullanilanKredi,
        toplamKota,
        toplamHarcamaTL,
        odendiAdet: odendiToplam._count,
      },
    });
  } catch (err) {
    console.error('[siparis] list', err);
    res.status(500).json({ message: 'Siparişler alınamadı', error: err.message });
  }
});

/**
 * POST /api/siparis/iap-verify — Apple/Google IAP doğrula; onay beklemeden krediyi doğrudan tanımla.
 * Body (iOS): { platform: 'ios', receipt: '<base64>', productId?: string }
 * Body (Android): { platform: 'android', productId: string, purchaseToken: string, packageName?: string }
 * Başarılı doğrulamada sipariş odendi olarak oluşturulur ve tesis kotası artırılır.
 */
router.post('/iap-verify', authenticateTesisOrSupabase, async (req, res) => {
  try {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }
    const tesisId = getTesisId(req);
    if (!tesisId) return res.status(403).json({ message: 'Tesis bilgisi bulunamadı' });

    const { platform, productId: bodyProductId, receipt, purchaseToken, packageName } = req.body || {};
    if (!platform || !['ios', 'android'].includes(platform)) {
      return res.status(400).json({ message: 'platform gerekli: ios veya android' });
    }

    let verifyResult;
    let idempotencyKey;

    if (platform === 'ios') {
      if (!receipt || typeof receipt !== 'string') {
        return res.status(400).json({ message: 'iOS için receipt (base64) gerekli' });
      }
      verifyResult = await verifyAppleReceipt(receipt.trim());
      if (!verifyResult.valid) {
        return res.status(400).json({ message: verifyResult.error || 'Apple makbuz doğrulanamadı' });
      }
      idempotencyKey = verifyResult.transactionId;
    } else {
      const pkgName = packageName && typeof packageName === 'string' ? packageName.trim() : 'com.litxtech.kbsprime';
      if (!bodyProductId || !purchaseToken) {
        return res.status(400).json({ message: 'Android için productId ve purchaseToken gerekli' });
      }
      verifyResult = await verifyGooglePurchase(pkgName, bodyProductId, purchaseToken.trim());
      if (!verifyResult.valid) {
        return res.status(400).json({ message: verifyResult.error || 'Google satın alma doğrulanamadı' });
      }
      idempotencyKey = verifyResult.transactionId;
    }

    const productId = verifyResult.productId || bodyProductId;
    const paket = productIdToPaket(platform, productId);
    if (!paket) {
      return res.status(400).json({ message: 'Bilinmeyen ürün. Geçerli paket: starter, pro, business.' });
    }

    const pkg = PACKAGES[paket];
    if (!pkg) return res.status(400).json({ message: 'Paket bulunamadı' });

    if (idempotencyKey) {
      const existing = await prisma.siparis.findFirst({
        where: { iapTransactionId: idempotencyKey },
      });
      if (existing) {
        const tesis = await prisma.tesis.findUnique({
          where: { id: tesisId },
          select: { kota: true, kullanilanKota: true },
        });
        const toplamKota = tesis?.kota ?? 0;
        const kullanilanKredi = tesis?.kullanilanKota ?? 0;
        return res.json({
          message: 'Bu satın alma zaten işlendi.',
          siparisNo: existing.siparisNo,
          ozet: { kalanKredi: Math.max(0, toplamKota - kullanilanKredi), kullanilanKredi, toplamKota },
        });
      }
    }

    const tesis = await prisma.tesis.findUnique({ where: { id: tesisId } });
    if (!tesis) return res.status(403).json({ message: 'Tesis bulunamadı' });

    const kredi = pkg.credits;
    const now = new Date();
    const mevcutKota = tesis.kota ?? 0;
    const yeniKota = mevcutKota + kredi;
    const siparisNo = await generateSiparisNo();

    await prisma.$transaction([
      prisma.siparis.create({
        data: {
          siparisNo,
          tesisId,
          paket,
          tutarTL: Math.round(pkg.priceTL),
          kredi,
          durum: 'odendi',
          odemeAt: now,
          iapTransactionId: idempotencyKey || null,
        },
      }),
      prisma.tesis.update({
        where: { id: tesisId },
        data: {
          paket,
          trialEndsAt: null,
          kota: yeniKota,
        },
      }),
    ]);

    const tesisGuncel = await prisma.tesis.findUnique({
      where: { id: tesisId },
      select: { kota: true, kullanilanKota: true },
    });
    const toplamKota = tesisGuncel?.kota ?? yeniKota;
    const kullanilanKredi = tesisGuncel?.kullanilanKota ?? 0;

    res.status(201).json({
      message: 'Ödeme doğrulandı, kredi hesabınıza tanımlandı.',
      siparisNo,
      paket,
      kredi,
      ozet: {
        kalanKredi: Math.max(0, toplamKota - kullanilanKredi),
        kullanilanKredi,
        toplamKota,
      },
    });
  } catch (err) {
    console.error('[siparis] iap-verify', err);
    res.status(500).json({ message: 'IAP doğrulama başarısız', error: err.message });
  }
});

module.exports = router;
