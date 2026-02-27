const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const prisma = new PrismaClient();

const router = express.Router();

router.use(authenticateTesisOrSupabase);

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis.id;
}

/**
 * Rapor özeti: doluluk, aktif misafir, bu ay giriş, ortalama kalış.
 * GET /api/rapor
 */
router.get('/', async (req, res) => {
  try {
    const tesisId = getTesisId(req);

    const [odalar, aktifMisafirSayisi, buAyGiren, cikisYapmisMisafirler] = await Promise.all([
      prisma.oda.findMany({
        where: { tesisId },
        select: { id: true, durum: true },
      }),
      prisma.misafir.count({
        where: { tesisId, cikisTarihi: null },
      }),
      prisma.misafir.count({
        where: {
          tesisId,
          girisTarihi: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
      }),
      prisma.misafir.findMany({
        where: { tesisId, cikisTarihi: { not: null } },
        select: { girisTarihi: true, cikisTarihi: true },
      }),
    ]);

    const toplamOda = odalar.length;
    const doluOda = odalar.filter((o) => o.durum === 'dolu').length;
    const dolulukOrani = toplamOda > 0 ? Math.round((doluOda / toplamOda) * 100) : 0;

    let ortalamaKalısGun = null;
    if (cikisYapmisMisafirler.length > 0) {
      const toplamGun = cikisYapmisMisafirler.reduce((acc, m) => {
        const giris = new Date(m.girisTarihi).getTime();
        const cikis = new Date(m.cikisTarihi).getTime();
        return acc + (cikis - giris) / (1000 * 60 * 60 * 24);
      }, 0);
      ortalamaKalısGun = Math.round((toplamGun / cikisYapmisMisafirler.length) * 10) / 10;
    }

    res.json({
      toplamOda,
      doluOda,
      dolulukOrani,
      aktifMisafirSayisi,
      buAyYeniMisafir: buAyGiren,
      ortalamaKalısGun,
    });
  } catch (error) {
    console.error('Rapor hatası:', error);
    res.status(500).json({ message: 'Rapor alınamadı', error: error.message });
  }
});

module.exports = router;
