const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { maskAdSoyad } = require('../utils/mask');
const { ensureTesisForBranch } = require('../lib/ensureTesisForBranch');
const { errorResponse } = require('../lib/errorResponse');
const prisma = new PrismaClient();

const router = express.Router();

router.use(authenticateTesisOrSupabase);

/** Supabase: branchId; legacy: req.tesis.id — Prisma Oda.tesisId ile eşleşir. */
function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis.id;
}

/**
 * Tüm odaları listele (filtreli)
 */
router.get('/', async (req, res) => {
  try {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }
    const { filtre } = req.query; // tumu, bos, dolu, hatali
    const tesisId = getTesisId(req);
    const where = { tesisId };

    if (filtre === 'bos') {
      where.durum = 'bos';
    } else if (filtre === 'dolu') {
      where.durum = 'dolu';
    }

    const odalar = await prisma.oda.findMany({
      where,
      include: {
        misafirler: {
          where: { cikisTarihi: null },
          orderBy: { girisTarihi: 'desc' },
          take: 1,
          include: {
            bildirimler: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      },
      orderBy: { odaNumarasi: 'asc' }
    });

    // Hatalı bildirim filtresi
    let filteredOdalar = odalar;
    if (filtre === 'hatali') {
      filteredOdalar = odalar.filter(oda => {
        const sonBildirim = oda.misafirler[0]?.bildirimler[0];
        return sonBildirim && sonBildirim.durum === 'hatali';
      });
    }

    const formattedOdalar = filteredOdalar.map(oda => {
      const misafir = oda.misafirler[0];
      const bildirim = misafir?.bildirimler[0];
      const maskedName = misafir ? maskAdSoyad(misafir.ad, misafir.soyad) : null;
      const odadaMi = !!(misafir && !misafir.cikisTarihi);

      return {
        id: oda.id,
        odaNumarasi: oda.odaNumarasi,
        odaTipi: oda.odaTipi,
        kapasite: oda.kapasite,
        fotograf: oda.fotograf,
        durum: oda.durum,
        odadaMi,
        misafir: misafir ? {
          id: misafir.id,
          ad: maskedName.ad,
          soyad: maskedName.soyad,
          girisTarihi: misafir.girisTarihi
        } : null,
        kbsDurumu: bildirim ? bildirim.durum : null
      };
    });

    res.json({ odalar: formattedOdalar });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) {
      return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    }
    if (isDb) {
      return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    }
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Odalar alınamadı.');
  }
});

/**
 * Oda detayı
 */
router.get('/:odaId', async (req, res) => {
  try {
    const tesisId = getTesisId(req);
    const oda = await prisma.oda.findFirst({
      where: {
        id: req.params.odaId,
        tesisId
      },
      include: {
        misafirler: {
          where: { cikisTarihi: null },
          include: {
            bildirimler: {
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!oda) {
      return res.status(404).json({ message: 'Oda bulunamadı' });
    }

    res.json({ oda });
  } catch (error) {
    console.error('Oda detay hatası:', error);
    res.status(500).json({ message: 'Oda bilgisi alınamadı', error: error.message });
  }
});

/**
 * Yeni oda ekle
 */
router.post('/', async (req, res) => {
  try {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }

    const { odaNumarasi, odaTipi, kapasite, fotograf, not } = req.body;

    if (!odaNumarasi || !kapasite) {
      return res.status(400).json({ message: 'Oda numarası ve kapasite gerekli' });
    }

    // Aynı oda numarası kontrolü
    const existing = await prisma.oda.findUnique({
      where: {
        tesisId_odaNumarasi: {
          tesisId: getTesisId(req),
          odaNumarasi
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Bu oda numarası zaten kullanılıyor' });
    }

    const oda = await prisma.oda.create({
      data: {
        tesisId: getTesisId(req),
        odaNumarasi,
        odaTipi: odaTipi || '',
        kapasite: parseInt(kapasite),
        fotograf,
        not
      }
    });

    // Log
    await prisma.log.create({
      data: {
        tesisId: getTesisId(req),
        kullaniciId: req.user.id,
        islem: 'oda-ekle',
        detay: { odaNumarasi, kapasite }
      }
    });

    res.status(201).json({ message: 'Oda eklendi', oda });
  } catch (error) {
    console.error('Oda ekleme hatası:', error);
    res.status(500).json({ message: 'Oda eklenemedi', error: error.message });
  }
});

/**
 * Oda güncelle
 */
router.put('/:odaId', async (req, res) => {
  try {
    const { odaTipi, kapasite, fotograf, not } = req.body;

    const oda = await prisma.oda.update({
      where: {
        id: req.params.odaId,
        tesisId: getTesisId(req)
      },
      data: {
        odaTipi,
        kapasite: kapasite ? parseInt(kapasite) : undefined,
        fotograf,
        not
      }
    });

    // Log
    await prisma.log.create({
      data: {
        tesisId: getTesisId(req),
        kullaniciId: req.user.id,
        islem: 'oda-guncelle',
        detay: { odaId: oda.id }
      }
    });

    res.json({ message: 'Oda güncellendi', oda });
  } catch (error) {
    console.error('Oda güncelleme hatası:', error);
    res.status(500).json({ message: 'Oda güncellenemedi', error: error.message });
  }
});

/**
 * Oda sil
 */
router.delete('/:odaId', async (req, res) => {
  try {
    // Dolu oda kontrolü
    const oda = await prisma.oda.findFirst({
      where: {
        id: req.params.odaId,
        tesisId: getTesisId(req)
      },
      include: {
        misafirler: {
          where: { cikisTarihi: null }
        }
      }
    });

    if (!oda) {
      return res.status(404).json({ message: 'Oda bulunamadı' });
    }

    if (oda.misafirler.length > 0) {
      return res.status(400).json({ message: 'Dolu oda silinemez' });
    }

    await prisma.oda.delete({
      where: { id: oda.id }
    });

    // Log
    await prisma.log.create({
      data: {
        tesisId: getTesisId(req),
        kullaniciId: req.user.id,
        islem: 'oda-sil',
        detay: { odaNumarasi: oda.odaNumarasi }
      }
    });

    res.json({ message: 'Oda silindi' });
  } catch (error) {
    console.error('Oda silme hatası:', error);
    res.status(500).json({ message: 'Oda silinemedi', error: error.message });
  }
});

module.exports = router;

