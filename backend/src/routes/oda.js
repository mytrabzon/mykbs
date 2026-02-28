/**
 * Oda ekleme / listeleme — bağlantı zinciri:
 *
 * 1) Mobil: POST/GET → EXPO_PUBLIC_BACKEND_URL (örn. https://mykbs-production.up.railway.app) + /api/oda
 * 2) Backend: server.js → /api/oda → bu router (oda.js)
 * 3) Auth: authenticateTesisOrSupabase → req.branchId (Supabase) veya req.tesis.id (legacy)
 * 4) DB: Tek kaynak = Railway env DATABASE_URL (Supabase Postgres). Prisma bu URL ile bağlanır.
 * 5) Oda eklerken: Supabase kullanıcıysa önce ensureTesisForBranch(prisma, branchId, branchName)
 *    → Prisma'da bu branch için Tesis kaydı yoksa prisma.tesis.create() çalışır.
 *    → Bu create pooler (Supavisor) ile 08P01 "insufficient data left in message" verebilir.
 *    → Çözüm: DATABASE_URL'de direct (5432) veya Session mode + ?pgbouncer=true
 */
const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { maskAdSoyad } = require('../utils/mask');
const { ensureTesisForBranch } = require('../lib/ensureTesisForBranch');
const { errorResponse } = require('../lib/errorResponse');

const router = express.Router();

router.use(authenticateTesisOrSupabase);

/** Supabase: branchId; legacy: req.tesis.id — Prisma Oda.tesisId ile eşleşir. */
function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis.id;
}

const ODA_STEP = { START: 'oda_start', ENSURE_TESIS: 'oda_ensure_tesis', QUERY: 'oda_query', FILTER: 'oda_filter', FORMAT: 'oda_format' };

/**
 * Tüm odaları listele (filtreli)
 */
router.get('/', async (req, res) => {
  const requestId = req.requestId || '-';
  try {
    console.log('[oda GET] step=START', { requestId, filtre: req.query?.filtre, authSource: req.authSource });
    if (req.authSource === 'supabase' && req.branch) {
      console.log('[oda GET] step=ENSURE_TESIS', { requestId, branchId: req.branchId });
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

    console.log('[oda GET] step=QUERY', { requestId, tesisId, filtre });
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
    console.log('[oda GET] step=FILTER', { requestId, odalarCount: odalar.length, filtre });

    // Hatalı bildirim filtresi
    let filteredOdalar = odalar;
    if (filtre === 'hatali') {
      filteredOdalar = odalar.filter(oda => {
        const sonBildirim = oda.misafirler[0]?.bildirimler[0];
        return sonBildirim && sonBildirim.durum === 'hatali';
      });
    }

    console.log('[oda GET] step=FORMAT', { requestId, formattedCount: filteredOdalar.length });
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
    const step = error?.step || ODA_STEP.QUERY;
    console.error('[oda GET] hata', {
      requestId: req.requestId,
      step,
      message: msg,
      code: error?.code,
      meta: error?.meta,
    });
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) {
      return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.', { step });
    }
    if (isDb) {
      return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.', { step });
    }
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Odalar alınamadı.', { step });
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
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Oda bilgisi alınamadı.');
  }
});

/**
 * Yeni oda ekle
 */
function is08P01(err) {
  const msg = String(err?.message || err?.meta?.code || '');
  return err?.code === '08P01' || msg.includes('08P01') || msg.includes('insufficient data left in message');
}

router.post('/', async (req, res) => {
  const run = async () => {
    if (req.authSource === 'supabase' && req.branch) {
      await ensureTesisForBranch(prisma, req.branchId, req.branch.name);
    }

    const { odaNumarasi, odaTipi, kapasite, fotograf, not } = req.body;

    if (!odaNumarasi || !kapasite) {
      return res.status(400).json({ message: 'Oda numarası ve kapasite gerekli' });
    }

    const tesisId = getTesisId(req);

    const existing = await prisma.oda.findUnique({
      where: {
        tesisId_odaNumarasi: { tesisId, odaNumarasi }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Bu oda numarası zaten kullanılıyor' });
    }

    const oda = await prisma.oda.create({
      data: {
        tesisId,
        odaNumarasi,
        odaTipi: odaTipi || '',
        kapasite: parseInt(kapasite),
        fotograf,
        not
      }
    });

    try {
      await prisma.log.create({
        data: {
          tesisId,
          kullaniciId: req.user.id,
          islem: 'oda-ekle',
          detay: JSON.stringify({ odaNumarasi, kapasite })
        }
      });
    } catch (logErr) {
      console.warn('[oda POST] log create atlandi', logErr?.message);
    }

    res.status(201).json({ message: 'Oda kuruldu', oda });
  };

  let lastError;
  try {
    await run();
    return;
  } catch (error) {
    lastError = error;
    console.error('[oda POST] hata', {
      requestId: req.requestId,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
    });
    if (is08P01(error)) {
      try {
        await run();
        return;
      } catch (retryErr) {
        console.error('[oda POST] retry hata', { code: retryErr?.code, message: retryErr?.message });
        if (is08P01(retryErr)) {
          return errorResponse(req, res, 503, 'DB_POOLER_ERROR', 'Veritabanı bağlantısı geçici hata verdi. Tekrar deneyin. (Yönetici: DATABASE_URL için direct veya pgbouncer=true)');
        }
        lastError = retryErr;
      }
    }
    const msg = lastError?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Oda eklenemedi.');
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
        detay: JSON.stringify({ odaId: oda.id })
      }
    });

    res.json({ message: 'Oda güncellendi', oda });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Oda güncellenemedi.');
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
        detay: JSON.stringify({ odaNumarasi: oda.odaNumarasi })
      }
    });

    res.json({ message: 'Oda silindi' });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Oda silinemedi.');
  }
});

module.exports = router;

