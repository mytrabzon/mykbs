const express = require('express');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const emailService = require('../services/email');
const whatsappService = require('../services/whatsapp');
const prisma = new PrismaClient();

const router = express.Router();

// Basit admin authentication (gerçek uygulamada JWT kullanılmalı)
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-key';

const adminAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== ADMIN_SECRET) {
    return res.status(401).json({ message: 'Admin yetkisi gerekli' });
  }
  next();
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
    const mesaj = `MyKBS'ye Hoş Geldiniz

Başvurunuz onaylanmıştır. Uygulamaya giriş için:
Tesis Kodu: ${tesis.tesisKodu}
Aktivasyon Şifresi: ${aktivasyonSifre}
Giriş Linki: ${girisLinki}

Bu şifre tek kullanımlıktır. İlk girişte kendi kalıcı PIN'inizi oluşturmanız istenecektir.
MyKBS ekibi`;

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

    const mesaj = `MyKBS'ye Hoş Geldiniz

Başvurunuz onaylanmıştır. Uygulamaya giriş için:
Tesis Kodu: ${tesis.tesisKodu}
Aktivasyon Şifresi: ${aktivasyonSifre}
Giriş Linki: ${girisLinki}

Bu şifre tek kullanımlıktır. İlk girişte kendi kalıcı PIN'inizi oluşturmanız istenecektir.
MyKBS ekibi`;

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
 * Paket değiştir
 */
router.put('/tesis/:tesisId/paket', async (req, res) => {
  try {
    const { tesisId } = req.params;
    const { paket, kota } = req.body;

    if (!paket || !['deneme', 'standart', 'pro'].includes(paket)) {
      return res.status(400).json({ message: 'Geçerli bir paket seçiniz' });
    }

    const updateData = { paket };
    if (kota) updateData.kota = parseInt(kota);

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
