const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { errorResponse } = require('../lib/errorResponse');

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
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Rapor alınamadı.');
  }
});

module.exports = router;
