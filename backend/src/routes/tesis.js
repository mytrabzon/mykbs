const express = require('express');
const axios = require('axios');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { createKBSService } = require('../services/kbs');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const { ensureTesisForBranch } = require('../lib/ensureTesisForBranch');
const { errorResponse } = require('../lib/errorResponse');

const router = express.Router();

// Tesis rotaları: Supabase token (mobil) veya legacy JWT (Prisma) kabul eder
router.use(authenticateTesisOrSupabase);

/**
 * Tesis bilgilerini getir (Supabase: branch özeti; Prisma: tesis + odalar)
 */
router.get('/', async (req, res) => {
  try {
    if (req.authSource === 'supabase') {
      const branch = req.branch;
      await ensureTesisForBranch(prisma, req.branchId, branch.name);
      const tesis = await prisma.tesis.findUnique({
        where: { id: req.branchId },
        include: {
          _count: { select: { odalar: true, bildirimler: true } }
        }
      });
      const doluOda = tesis ? await prisma.oda.count({ where: { tesisId: req.branchId, durum: 'dolu' } }) : 0;
      const bugunGiris = tesis ? await prisma.misafir.count({
        where: {
          tesisId: req.branchId,
          girisTarihi: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }) : 0;
      const bugunCikis = tesis ? await prisma.misafir.count({
        where: {
          tesisId: req.branchId,
          cikisTarihi: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
        }
      }) : 0;
      const hataliBildirim = tesis ? await prisma.bildirim.count({
        where: { tesisId: req.branchId, durum: 'hatali' }
      }) : 0;
      return res.json({
        tesis: {
          id: branch.id,
          tesisAdi: branch.name,
          kbsTuru: branch.kbs_turu,
          kbsConnected: !!(branch.kbs_configured && branch.kbs_turu && branch.kbs_tesis_kodu),
          paket: tesis?.paket || 'deneme',
          kota: tesis?.kota ?? 100,
          kullanilanKota: tesis?.kullanilanKota ?? 0
        },
        ozet: {
          toplamOda: tesis?._count?.odalar ?? 0,
          doluOda,
          bugunGiris,
          bugunCikis,
          hataliBildirim
        }
      });
    }
    const tesis = await prisma.tesis.findUnique({
      where: { id: req.tesis.id },
      include: {
        odalar: {
          include: {
            misafirler: {
              where: { cikisTarihi: null },
              orderBy: { girisTarihi: 'desc' },
              take: 1
            }
          }
        },
        _count: {
          select: {
            odalar: true,
            bildirimler: true
          }
        }
      }
    });

    // Özet istatistikler
    const doluOdalar = tesis.odalar.filter(o => o.durum === 'dolu').length;
    const bugunGiris = await prisma.misafir.count({
      where: {
        tesisId: tesis.id,
        girisTarihi: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });
    const bugunCikis = await prisma.misafir.count({
      where: {
        tesisId: tesis.id,
        cikisTarihi: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      }
    });
    const hataliBildirim = await prisma.bildirim.count({
      where: {
        tesisId: tesis.id,
        durum: 'hatali'
      }
    });

    res.json({
      tesis: {
        id: tesis.id,
        tesisAdi: tesis.tesisAdi,
        paket: tesis.paket,
        kota: tesis.kota,
        kullanilanKota: tesis.kullanilanKota,
        kbsTuru: tesis.kbsTuru
      },
      ozet: {
        toplamOda: tesis._count.odalar,
        doluOda: doluOdalar,
        bugunGiris,
        bugunCikis,
        hataliBildirim
      }
    });
  } catch (error) {
    const requestId = req.requestId || '-';
    const step = 'tesis';
    if (requestId !== '-') {
      console.error(`[REQ ${requestId}] GET /api/tesis UNHANDLED -> stack:`, error?.stack || error);
    }
    const msg = error?.message || '';
    const code = error?.code || error?.meta?.code;
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    const is08P01 = code === '08P01' || /08P01|insufficient data left in message|Tesis kaydı oluşturulamadı/i.test(msg);
    const isP2025 = code === 'P2025' || (error?.meta?.code === 'P2025');
    if (isP2025) {
      return errorResponse(req, res, 404, 'NOT_FOUND', 'Kayıt bulunamadı.', { step });
    }
    if (is08P01) {
      return errorResponse(req, res, 503, 'DB_CONNECT_ERROR', 'Veritabanı bağlantısı geçici olarak kullanılamıyor. Lütfen kısa süre sonra tekrar deneyin.', { step });
    }
    if (isSchema) {
      return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.', { step });
    }
    if (isDb) {
      return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.', { step });
    }
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Bilgi alınamadı.', { step });
  }
});

/**
 * Tesis bilgilerini güncelle (otel adı vb.) – bilgiDuzenlemeYetki gerekli (Prisma) veya branch üyesi (Supabase)
 */
router.put('/bilgi', async (req, res) => {
  try {
    const { tesisAdi } = req.body;

    if (req.authSource === 'supabase') {
      if (!supabaseAdmin) return errorResponse(req, res, 503, 'UNHANDLED_ERROR', 'Supabase yapılandırılmamış');
      const name = (tesisAdi && String(tesisAdi).trim()) || null;
      if (!name) return res.status(400).json({ message: 'Tesis adı boş olamaz' });
      const { data, error } = await supabaseAdmin.from('branches').update({ name }).eq('id', req.branchId).select('id, name').single();
      if (error) return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'Tesis adı güncellenemedi');
      return res.json({ message: 'Tesis bilgileri güncellendi', tesis: { id: data.id, tesisAdi: data.name } });
    }

    if (!req.user.bilgiDuzenlemeYetki) {
      return errorResponse(req, res, 403, 'ROLE_FORBIDDEN', 'Tesis bilgilerini değiştirme yetkiniz yok');
    }
    const name = (tesisAdi && String(tesisAdi).trim()) || null;
    if (!name) return res.status(400).json({ message: 'Tesis adı boş olamaz' });

    const tesis = await prisma.tesis.update({
      where: { id: req.tesis.id },
      data: { tesisAdi: name }
    });

    await prisma.auditLog.create({
      data: {
        tesisId: tesis.id,
        kullaniciId: req.user.id,
        islem: 'tesis-bilgi-guncelle',
        yeniDeger: JSON.stringify({ tesisAdi: name })
      }
    });

    return res.json({
      message: 'Tesis bilgileri güncellendi',
      tesis: { id: tesis.id, tesisAdi: tesis.tesisAdi }
    });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Tesis bilgileri güncellenemedi.');
  }
});

/**
 * KBS ayarlarını getir (Supabase: branch; Prisma: tesis)
 */
router.get('/kbs', async (req, res) => {
  try {
    if (req.authSource === 'supabase') {
      const b = req.branch;
      return res.json({
        kbsTuru: b.kbs_turu || null,
        kbsTesisKodu: b.kbs_tesis_kodu || null,
        ipKisitAktif: false,
        ipAdresleri: []
      });
    }
    const tesis = await prisma.tesis.findUnique({
      where: { id: req.tesis.id },
      select: {
        kbsTuru: true,
        kbsTesisKodu: true,
        ipKisitAktif: true,
        ipAdresleri: true
      }
    });

    res.json(tesis);
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Ayarlar alınamadı.');
  }
});

/**
 * KBS için karakola bildirilecek sunucu IP'si (B2B: tüm otellerin istekleri bu IP'den çıkar).
 * Ayarlar ekranında "Karakola bildirilecek IP" olarak gösterilebilir.
 */
router.get('/kbs/server-ip', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
    const serverIp = data && typeof data.ip === 'string' ? data.ip : null;
    res.json({ serverIp, hint: 'Gerekirse teknik destekte kullanın.' });
  } catch (err) {
    res.status(503).json({ serverIp: null, hint: 'Sunucu IP\'si alınamadı.' });
  }
});

/**
 * KBS ayarlarını güncelle (Supabase: branches; Prisma: tesis)
 */
router.put('/kbs', async (req, res) => {
  try {
    const { kbsTuru, kbsTesisKodu, kbsWebServisSifre, ipKisitAktif, ipAdresleri } = req.body;

    if (req.authSource === 'supabase') {
      if (!supabaseAdmin) return errorResponse(req, res, 503, 'UNHANDLED_ERROR', 'Supabase yapılandırılmamış');
      const updateData = {};
      if (kbsTuru !== undefined) updateData.kbs_turu = kbsTuru;
      if (kbsTesisKodu !== undefined) updateData.kbs_tesis_kodu = kbsTesisKodu;
      if (kbsWebServisSifre !== undefined) updateData.kbs_web_servis_sifre = kbsWebServisSifre;
      if (Object.keys(updateData).length === 0) return res.json({ message: 'KBS ayarları güncellendi' });
      const { error } = await supabaseAdmin.from('branches').update(updateData).eq('id', req.branchId).select().single();
      if (error) return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'Ayarlar güncellenemedi');
      return res.json({ message: 'KBS ayarları güncellendi' });
    }

    if (!['sahip', 'yonetici'].includes(req.user.rol)) {
      return errorResponse(req, res, 403, 'ROLE_FORBIDDEN', 'Bu işlem için yetkiniz yok');
    }

    const updateData = {};
    if (kbsTuru) updateData.kbsTuru = kbsTuru;
    if (kbsTesisKodu) updateData.kbsTesisKodu = kbsTesisKodu;
    if (kbsWebServisSifre) updateData.kbsWebServisSifre = kbsWebServisSifre;
    if (ipKisitAktif !== undefined) updateData.ipKisitAktif = ipKisitAktif;
    if (ipAdresleri !== undefined) {
      updateData.ipAdresleri = Array.isArray(ipAdresleri)
        ? ipAdresleri.join(',')
        : typeof ipAdresleri === 'string' ? ipAdresleri : '';
    }

    const tesis = await prisma.tesis.update({
      where: { id: req.tesis.id },
      data: updateData
    });

    await prisma.auditLog.create({
      data: {
        tesisId: tesis.id,
        kullaniciId: req.user.id,
        islem: 'kbs-ayar-guncelle',
        yeniDeger: { kbsTuru, ipKisitAktif }
      }
    });

    res.json({ message: 'KBS ayarları güncellendi' });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Ayarlar güncellenemedi.');
  }
});

/**
 * KBS bağlantı testi (Supabase: branch; Prisma: tesis)
 */
/**
 * KBS değişiklik veya kaldırma talebi — admin onayına sunulur (audit’e yazılır)
 */
router.post('/kbs/talebi', async (req, res) => {
  try {
    const { type } = req.body; // 'change' | 'remove'
    if (!type || !['change', 'remove'].includes(type)) {
      return res.status(400).json({ message: 'Geçersiz talep türü (change veya remove)' });
    }
    const action = type === 'change' ? 'kbs_degisiklik_talebi' : 'kbs_kaldirma_talebi';
    if (req.authSource === 'supabase') {
      if (!supabaseAdmin) return errorResponse(req, res, 503, 'UNHANDLED_ERROR', 'Supabase yapılandırılmamış');
      const { error } = await supabaseAdmin.from('audit_logs').insert({
        branch_id: req.branchId,
        user_id: req.user.id,
        action,
        entity: 'kbs_settings',
        meta_json: { type, status: 'pending' }
      });
      if (error) return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'Talep kaydedilemedi');
      return res.json({ message: 'Talep admin onayına iletildi' });
    }
    await prisma.auditLog.create({
      data: {
        tesisId: req.tesis.id,
        kullaniciId: req.user.id,
        islem: action,
        yeniDeger: JSON.stringify({ type, status: 'pending' })
      }
    });
    return res.json({ message: 'Talep admin onayına iletildi' });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Talep gönderilemedi.');
  }
});

router.post('/kbs/test', async (req, res) => {
  try {
    const bodyKbs = req.body && typeof req.body === 'object' ? req.body : {};
    const fromBody = bodyKbs.kbsTuru && bodyKbs.kbsTesisKodu && bodyKbs.kbsWebServisSifre;

    let tesisLike;
    if (req.authSource === 'supabase') {
      const b = req.branch;
      if (fromBody) {
        tesisLike = {
          kbsTuru: bodyKbs.kbsTuru,
          kbsTesisKodu: String(bodyKbs.kbsTesisKodu).trim(),
          kbsWebServisSifre: bodyKbs.kbsWebServisSifre,
          ipAdresleri: []
        };
      } else if (b.kbs_turu && b.kbs_tesis_kodu && b.kbs_web_servis_sifre) {
        tesisLike = { kbsTuru: b.kbs_turu, kbsTesisKodu: b.kbs_tesis_kodu, kbsWebServisSifre: b.kbs_web_servis_sifre, ipAdresleri: [] };
      } else {
        return res.status(400).json({ message: 'KBS bilgileri eksik. Tesis kodu, şifre ve KBS türünü girin veya önce Kaydet ile talep gönderin.' });
      }
    } else {
      if (fromBody) {
        tesisLike = {
          kbsTuru: bodyKbs.kbsTuru,
          kbsTesisKodu: String(bodyKbs.kbsTesisKodu).trim(),
          kbsWebServisSifre: bodyKbs.kbsWebServisSifre,
          ipAdresleri: []
        };
      } else {
        const tesis = await prisma.tesis.findUnique({ where: { id: req.tesis.id } });
        if (!tesis || !tesis.kbsTuru || !tesis.kbsTesisKodu || !tesis.kbsWebServisSifre) {
          return res.status(400).json({ message: 'KBS bilgileri eksik' });
        }
        tesisLike = tesis;
      }
    }

    const kbsService = createKBSService(tesisLike);
    const testResult = await kbsService.testBaglanti();

    res.json(testResult);
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', msg || 'Test başarısız');
  }
});

/**
 * KBS'ten mevcut misafirleri çekip sisteme aktar (farklı sistemden geçen kullanıcı, KBS bilgilerini yazınca kaldığı yerden devam etsin).
 * KBS API'de misafir listesi endpoint'i yoksa veya boş dönerse imported: 0 ve mesaj döner.
 */
router.post('/kbs/import', async (req, res) => {
  try {
    if (req.authSource === 'supabase') {
      await ensureTesisForBranch(prisma, req.branchId, req.branch?.name);
    }

    const bodyKbs = req.body && typeof req.body === 'object' ? req.body : {};
    const fromBody = bodyKbs.kbsTuru && bodyKbs.kbsTesisKodu && bodyKbs.kbsWebServisSifre;

    const tesisId = req.authSource === 'supabase' ? req.branchId : req.tesis.id;
    let tesisLike;
    if (req.authSource === 'supabase') {
      const b = req.branch;
      if (fromBody) {
        tesisLike = {
          kbsTuru: bodyKbs.kbsTuru,
          kbsTesisKodu: String(bodyKbs.kbsTesisKodu).trim(),
          kbsWebServisSifre: bodyKbs.kbsWebServisSifre,
          ipAdresleri: []
        };
      } else if (b.kbs_turu && b.kbs_tesis_kodu && b.kbs_web_servis_sifre) {
        tesisLike = { kbsTuru: b.kbs_turu, kbsTesisKodu: b.kbs_tesis_kodu, kbsWebServisSifre: b.kbs_web_servis_sifre, ipAdresleri: [] };
      } else {
        return res.status(400).json({ message: 'KBS bilgileri eksik. Önce Ayarlar\'dan KBS tesis kodu ve şifreyi girin.' });
      }
    } else {
      if (fromBody) {
        tesisLike = {
          kbsTuru: bodyKbs.kbsTuru,
          kbsTesisKodu: String(bodyKbs.kbsTesisKodu).trim(),
          kbsWebServisSifre: bodyKbs.kbsWebServisSifre,
          ipAdresleri: []
        };
      } else {
        const tesis = await prisma.tesis.findUnique({ where: { id: req.tesis.id } });
        if (!tesis || !tesis.kbsTuru || !tesis.kbsTesisKodu || !tesis.kbsWebServisSifre) {
          return res.status(400).json({ message: 'KBS bilgileri eksik' });
        }
        tesisLike = tesis;
      }
    }

    const kbsService = createKBSService(tesisLike);
    const result = await kbsService.misafirListesiGetir();

    if (!result.success || !result.misafirler || result.misafirler.length === 0) {
      return res.json({
        imported: 0,
        skipped: 0,
        message: result.message || 'KBS\'ten misafir listesi alınamadı veya liste boş. Bu KBS türünde liste sorgulama desteklenmiyorsa manuel check-in kullanın.'
      });
    }

    let imported = 0;
    let skipped = 0;

    for (const g of result.misafirler) {
      if (!g.ad && !g.soyad) continue;
      if (!g.kimlikNo && !g.pasaportNo) {
        skipped++;
        continue;
      }

      const odaNumarasi = (g.odaNumarasi || '').toString().trim() || 'Bilinmeyen';
      let oda = await prisma.oda.findFirst({
        where: { tesisId, odaNumarasi }
      });
      if (!oda) {
        oda = await prisma.oda.create({
          data: {
            tesisId,
            odaNumarasi,
            odaTipi: 'Standart',
            kapasite: 2,
            durum: 'bos'
          }
        });
      }

      const orConditions = [];
      if (g.kimlikNo && String(g.kimlikNo).trim()) orConditions.push({ kimlikNo: String(g.kimlikNo).trim() });
      if (g.pasaportNo && String(g.pasaportNo).trim()) orConditions.push({ pasaportNo: String(g.pasaportNo).trim() });
      if (orConditions.length === 0) {
        skipped++;
        continue;
      }
      const existing = await prisma.misafir.findFirst({
        where: {
          tesisId,
          cikisTarihi: null,
          OR: orConditions
        }
      });
      if (existing) {
        skipped++;
        continue;
      }

      const dogumTarihi = g.dogumTarihi ? new Date(g.dogumTarihi) : new Date(1990, 0, 1);
      const girisTarihi = g.girisTarihi ? new Date(g.girisTarihi) : new Date();
      const cikisTarihi = g.cikisTarihi ? new Date(g.cikisTarihi) : null;

      await prisma.misafir.create({
        data: {
          tesisId,
          odaId: oda.id,
          ad: (g.ad || '').trim() || 'Misafir',
          soyad: (g.soyad || '').trim() || '—',
          kimlikNo: (g.kimlikNo || '').trim() || '—',
          pasaportNo: (g.pasaportNo || '').trim() || null,
          dogumTarihi,
          uyruk: (g.uyruk || 'TÜRK').trim(),
          girisTarihi,
          cikisTarihi
        }
      });

      if (!cikisTarihi && oda.durum !== 'dolu') {
        await prisma.oda.update({
          where: { id: oda.id },
          data: { durum: 'dolu' }
        });
      }
      imported++;
    }

    const message = imported > 0
      ? `${imported} misafir KBS'ten aktarıldı.${skipped > 0 ? ` ${skipped} zaten kayıtlıydı.` : ''}`
      : (skipped > 0 ? `Tüm kayıtlar zaten mevcut (${skipped}).` : (result.message || 'Aktarım tamamlandı.'));

    res.json({ imported, skipped, message });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', msg || 'Aktarım başarısız');
  }
});

module.exports = router;

