const express = require('express');
const { prisma } = require('../lib/prisma');
const crypto = require('crypto');
const emailService = require('../services/email');
const whatsappService = require('../services/whatsapp');
const { VALID_PAKET_KEYS, getPackageCredits, setTrialDefaults } = require('../config/packages');
const appAdminRouter = require('./appAdmin');

const router = express.Router();

const ADMIN_SECRET = (process.env.ADMIN_SECRET || 'admin-secret-key').trim();
const DEFAULT_ADMIN_SECRET = 'admin-secret-key';

const adminAuth = (req, res, next) => {
  const token = (req.headers.authorization?.replace('Bearer ', '') || '').trim();
  // Production'da varsayılan şifre kabul edilmez
  if (process.env.NODE_ENV === 'production' && (!ADMIN_SECRET || ADMIN_SECRET === DEFAULT_ADMIN_SECRET)) {
    return res.status(503).json({ message: 'Admin erişimi yapılandırılmamış. ADMIN_SECRET tanımlayın.' });
  }
  if (token && token === ADMIN_SECRET) {
    return next();
  }
  if (process.env.NODE_ENV === 'production' && token === DEFAULT_ADMIN_SECRET) {
    return res.status(403).json({ message: 'Geçersiz admin anahtarı.' });
  }
  appAdminRouter.requireAdminPanelUser(req, res, next);
};

router.use(adminAuth);

/**
 * Dashboard istatistikleri
 */
router.get('/dashboard', async (req, res) => {
  try {
    const toplamTesis = await prisma.tesis.count();
    const aktifTesis = await prisma.tesis.count({ where: { durum: 'aktif' } });
    
    const paketDagilimi = await prisma.tesis.groupBy({
      by: ['paket'],
      _count: true,
      where: { durum: 'aktif' }
    });

    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    const yarin = new Date(bugun);
    yarin.setDate(yarin.getDate() + 1);

    const gunlukBildirim = await prisma.bildirim.count({
      where: {
        createdAt: { gte: bugun, lt: yarin }
      }
    });

    const gunlukHata = await prisma.bildirim.count({
      where: {
        createdAt: { gte: bugun, lt: yarin },
        durum: 'hatali'
      }
    });

    const kotaAsimi = await prisma.tesis.findMany({
      where: {
        durum: 'aktif',
        kullanilanKota: { gte: prisma.raw('kota') }
      },
      select: {
        id: true,
        tesisAdi: true,
        paket: true,
        kota: true,
        kullanilanKota: true
      }
    });

    res.json({
      toplamTesis,
      aktifTesis,
      paketDagilimi: paketDagilimi.reduce((acc, p) => {
        acc[p.paket] = p._count;
        return acc;
      }, {}),
      gunlukBildirim,
      gunlukHata,
      kotaAsimi
    });
  } catch (error) {
    console.error('Dashboard hatası:', error);
    res.status(500).json({ message: 'Dashboard verileri alınamadı', error: error.message });
  }
});

/**
 * Tesis kodu + PIN giriş talepleri (admin onayı bekleyenler)
 */
router.get('/giris-talepleri', async (req, res) => {
  try {
    const talepler = await prisma.kullanici.findMany({
      where: {
        girisOnaylandi: false,
        girisTalepAt: { not: null }
      },
      include: {
        tesis: {
          select: {
            id: true,
            tesisAdi: true,
            tesisKodu: true,
            telefon: true,
            email: true
          }
        }
      },
      orderBy: { girisTalepAt: 'desc' }
    });
    res.json({ talepler });
  } catch (error) {
    console.error('Giriş talepleri hatası:', error);
    res.status(500).json({ message: 'Talepler alınamadı', error: error.message });
  }
});

/**
 * Tesis kodu + PIN giriş onayı ver (onaylandığı an kullanıcı giriş yapabilir)
 */
router.post('/giris-onay/:kullaniciId', async (req, res) => {
  try {
    const { kullaniciId } = req.params;
    await prisma.kullanici.update({
      where: { id: kullaniciId },
      data: { girisOnaylandi: true }
    });
    res.json({ message: 'Giriş onaylandı. Kullanıcı artık tesis kodu ve PIN ile giriş yapabilir.' });
  } catch (error) {
    console.error('Giriş onay hatası:', error);
    res.status(500).json({ message: 'Onay verilemedi', error: error.message });
  }
});

/**
 * Tesis listesi
 */
router.get('/tesisler', async (req, res) => {
  try {
    const { paket, durum, sehir, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (paket) where.paket = paket;
    if (durum) where.durum = durum;
    if (sehir) where.il = sehir;

    const tesisler = await prisma.tesis.findMany({
      where,
      select: {
        id: true,
        tesisAdi: true,
        yetkiliAdSoyad: true,
        telefon: true,
        email: true,
        il: true,
        paket: true,
        kota: true,
        kullanilanKota: true,
        kbsTuru: true,
        durum: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    res.json({ tesisler });
  } catch (error) {
    console.error('Tesis listesi hatası:', error);
    res.status(500).json({ message: 'Tesisler alınamadı', error: error.message });
  }
});

/**
 * Tesis detayı
 */
router.get('/tesis/:tesisId', async (req, res) => {
  try {
    const tesis = await prisma.tesis.findUnique({
      where: { id: req.params.tesisId },
      include: {
        _count: {
          select: {
            odalar: true,
            bildirimler: true,
            kullanicilar: true
          }
        }
      }
    });

    if (!tesis) {
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }

    res.json({ tesis });
  } catch (error) {
    console.error('Tesis detay hatası:', error);
    res.status(500).json({ message: 'Tesis bilgisi alınamadı', error: error.message });
  }
});

/**
 * KBS geçmişini çek (tesis Prisma kaydına göre). Jandarma/Polis listesi desteklemiyorsa imported: 0 döner.
 */
router.post('/tesis/:tesisId/kbs-sync', async (req, res) => {
  try {
    const { tesisId } = req.params;
    const tesis = await prisma.tesis.findUnique({
      where: { id: tesisId }
    });
    if (!tesis) {
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }
    if (!tesis.kbsTuru || !tesis.kbsTesisKodu || !tesis.kbsWebServisSifre) {
      return res.status(400).json({ message: 'Bu tesisin KBS bilgileri eksik. Önce KBS türü, tesis kodu ve şifre girilmeli.' });
    }
    const createKBSService = require('../services/kbs').createKBSService;
    const tesisLike = {
      kbsTuru: tesis.kbsTuru,
      kbsTesisKodu: tesis.kbsTesisKodu,
      kbsWebServisSifre: tesis.kbsWebServisSifre,
      ipAdresleri: []
    };
    const kbsService = createKBSService(tesisLike);
    const result = await kbsService.misafirListesiGetir();

    if (!result.success || !result.misafirler || result.misafirler.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: result.message || 'KBS\'ten misafir listesi alınamadı veya liste boş. (Jandarma KBS liste sorgulama desteklemiyor olabilir.)'
      });
    }

    let imported = 0;
    let skipped = 0;
    for (const g of result.misafirler) {
      if (!g.ad && !g.soyad) continue;
      if (!g.kimlikNo && !g.pasaportNo) { skipped++; continue; }
      const odaNumarasi = (g.odaNumarasi || '').toString().trim() || 'Bilinmeyen';
      let oda = await prisma.oda.findFirst({ where: { tesisId, odaNumarasi } });
      if (!oda) {
        oda = await prisma.oda.create({
          data: { tesisId, odaNumarasi, odaTipi: 'Standart', kapasite: 2, durum: 'bos' }
        });
      }
      const orConditions = [];
      if (g.kimlikNo && String(g.kimlikNo).trim()) orConditions.push({ kimlikNo: String(g.kimlikNo).trim() });
      if (g.pasaportNo && String(g.pasaportNo).trim()) orConditions.push({ pasaportNo: String(g.pasaportNo).trim() });
      if (orConditions.length === 0) { skipped++; continue; }
      const existing = await prisma.misafir.findFirst({
        where: { tesisId, cikisTarihi: null, OR: orConditions }
      });
      if (existing) { skipped++; continue; }
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
        await prisma.oda.update({ where: { id: oda.id }, data: { durum: 'dolu' } });
      }
      imported++;
    }

    const message = imported > 0
      ? `${imported} kayıt senkronize edildi.${skipped > 0 ? ` ${skipped} zaten kayıtlıydı.` : ''}`
      : (skipped > 0 ? `Tüm kayıtlar zaten mevcut (${skipped}).` : 'Aktarım tamamlandı.');
    res.json({ success: true, count: imported, skipped, message });
  } catch (error) {
    console.error('KBS sync hatası:', error);
    res.status(500).json({ message: error?.message || 'Senkronizasyon başarısız' });
  }
});

/**
 * Tesis odaları listesi (admin panel odalar sayfası)
 */
router.get('/tesis/:tesisId/odalar', async (req, res) => {
  try {
    const { tesisId } = req.params;
    const tesis = await prisma.tesis.findUnique({
      where: { id: tesisId },
      select: { id: true, tesisAdi: true, tesisKodu: true }
    });
    if (!tesis) {
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }
    const odalar = await prisma.oda.findMany({
      where: { tesisId },
      include: {
        _count: { select: { misafirler: true } },
        misafirler: {
          where: { cikisTarihi: null },
          take: 1,
          select: { id: true, ad: true, soyad: true }
        }
      },
      orderBy: [{ odaNumarasi: 'asc' }]
    });
    const toplam = odalar.length;
    const dolu = odalar.filter(o => o.durum === 'dolu').length;
    res.json({
      tesis: { id: tesis.id, tesisAdi: tesis.tesisAdi, tesisKodu: tesis.tesisKodu },
      odalar,
      ozet: { toplam, dolu, bos: toplam - dolu }
    });
  } catch (error) {
    console.error('Tesis odaları hatası:', error);
    res.status(500).json({ message: 'Odalar alınamadı', error: error.message });
  }
});

/**
 * Tesis onayla ve aktivasyon bilgileri oluştur
 */
router.post('/tesis/:tesisId/onayla', async (req, res) => {
  try {
    const { tesisId } = req.params;

    const tesis = await prisma.tesis.findUnique({
      where: { id: tesisId }
    });

    if (!tesis) {
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }

    // Aktivasyon şifresi oluştur (6 haneli OTP)
    const aktivasyonSifre = Math.floor(100000 + Math.random() * 900000).toString();
    const aktivasyonSifreExpiresAt = new Date();
    aktivasyonSifreExpiresAt.setDate(aktivasyonSifreExpiresAt.getDate() + 7); // 7 gün geçerli

    await prisma.tesis.update({
      where: { id: tesisId },
      data: {
        durum: 'onaylandi',
        aktivasyonSifre,
        aktivasyonSifreExpiresAt
      }
    });

    // Giriş linki oluştur
    const girisLinki = `${process.env.APP_URL || 'https://app.mykbs.com'}/aktivasyon?kod=${tesis.tesisKodu}`;

    // Hoş geldiniz mesajı
    const mesaj = `KBS Prime'a Hoş Geldiniz

Başvurunuz onaylanmıştır. Uygulamaya giriş için:
Tesis Kodu: ${tesis.tesisKodu}
Aktivasyon Şifresi: ${aktivasyonSifre}
Giriş Linki: ${girisLinki}

Bu şifre tek kullanımlıktır. İlk girişte kendi kalıcı PIN'inizi oluşturmanız istenecektir.
KBS Prime ekibi`;

    const aktivasyonBilgileri = {
      tesisKodu: tesis.tesisKodu,
      aktivasyonSifre,
      girisLinki,
      mesaj
    };

    // WhatsApp ve Email gönder (opsiyonel, hata olsa bile devam et)
    try {
      await whatsappService.sendActivationMessage(tesis.telefon, aktivasyonBilgileri);
    } catch (error) {
      console.error('WhatsApp gönderme hatası:', error);
    }

    try {
      await emailService.sendActivationEmail(tesis.email, aktivasyonBilgileri);
    } catch (error) {
      console.error('Email gönderme hatası:', error);
    }

    res.json({
      message: 'Tesis onaylandı',
      aktivasyonBilgileri
    });
  } catch (error) {
    console.error('Tesis onaylama hatası:', error);
    res.status(500).json({ message: 'Tesis onaylanamadı', error: error.message });
  }
});

/**
 * Yeni aktivasyon şifresi üret
 */
router.post('/tesis/:tesisId/yeni-sifre', async (req, res) => {
  try {
    const { tesisId } = req.params;

    const tesis = await prisma.tesis.findUnique({
      where: { id: tesisId }
    });

    if (!tesis) {
      return res.status(404).json({ message: 'Tesis bulunamadı' });
    }

    const aktivasyonSifre = Math.floor(100000 + Math.random() * 900000).toString();
    const aktivasyonSifreExpiresAt = new Date();
    aktivasyonSifreExpiresAt.setDate(aktivasyonSifreExpiresAt.getDate() + 7);

    await prisma.tesis.update({
      where: { id: tesisId },
      data: {
        aktivasyonSifre,
        aktivasyonSifreExpiresAt
      }
    });

    const girisLinki = `${process.env.APP_URL || 'https://app.mykbs.com'}/aktivasyon?kod=${tesis.tesisKodu}`;

    const mesaj = `KBS Prime'a Hoş Geldiniz

Başvurunuz onaylanmıştır. Uygulamaya giriş için:
Tesis Kodu: ${tesis.tesisKodu}
Aktivasyon Şifresi: ${aktivasyonSifre}
Giriş Linki: ${girisLinki}

Bu şifre tek kullanımlıktır. İlk girişte kendi kalıcı PIN'inizi oluşturmanız istenecektir.
KBS Prime ekibi`;

    const aktivasyonBilgileri = {
      tesisKodu: tesis.tesisKodu,
      aktivasyonSifre,
      girisLinki,
      mesaj
    };

    res.json({
      message: 'Yeni şifre oluşturuldu',
      aktivasyonBilgileri
    });
  } catch (error) {
    console.error('Yeni şifre oluşturma hatası:', error);
    res.status(500).json({ message: 'Şifre oluşturulamadı', error: error.message });
  }
});

/**
 * Paket değiştir (starter, pro, business, enterprise). Ek kredi için kota sayı olarak gönderilir.
 */
router.put('/tesis/:tesisId/paket', async (req, res) => {
  try {
    const { tesisId } = req.params;
    const { paket, kota } = req.body;

    if (!paket || !VALID_PAKET_KEYS.includes(paket)) {
      return res.status(400).json({ message: 'Geçerli bir paket seçiniz (deneme, starter, pro, business, enterprise)' });
    }

    const updateData = { paket };
    if (paket === 'deneme') {
      Object.assign(updateData, setTrialDefaults());
    } else {
      updateData.trialEndsAt = null;
      updateData.kota = kota != null ? parseInt(kota) : getPackageCredits(paket);
    }

    await prisma.tesis.update({
      where: { id: tesisId },
      data: updateData
    });

    res.json({ message: 'Paket güncellendi' });
  } catch (error) {
    console.error('Paket güncelleme hatası:', error);
    res.status(500).json({ message: 'Paket güncellenemedi', error: error.message });
  }
});

/**
 * Tesis logları
 */
router.get('/tesis/:tesisId/loglar', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const loglar = await prisma.log.findMany({
      where: { tesisId: req.params.tesisId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    res.json({ loglar });
  } catch (error) {
    console.error('Log listesi hatası:', error);
    res.status(500).json({ message: 'Loglar alınamadı', error: error.message });
  }
});

/**
 * Tesis hataları
 */
router.get('/tesis/:tesisId/hatalar', async (req, res) => {
  try {
    const { durum } = req.query;

    const where = { tesisId: req.params.tesisId };
    if (durum) where.durum = durum;

    const hatalar = await prisma.hata.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({ hatalar });
  } catch (error) {
    console.error('Hata listesi hatası:', error);
    res.status(500).json({ message: 'Hatalar alınamadı', error: error.message });
  }
});

module.exports = router;
