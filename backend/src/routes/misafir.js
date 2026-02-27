const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { createKBSService } = require('../services/kbs');
const { maskKimlikNo, maskPasaportNo } = require('../utils/mask');
const { canSendBildirim } = require('../config/packages');
const prisma = new PrismaClient();

const router = express.Router();

router.use(authenticate);

/**
 * Aktif misafirleri listele
 */
router.get('/', async (req, res) => {
  try {
    const { cikisYapmis, tam } = req.query;
    const kimlikGorebilir = tam === '1' && ['sahip', 'yonetici'].includes(req.user.rol);

    const where = {
      tesisId: req.tesis.id
    };

    if (cikisYapmis !== 'true') {
      where.cikisTarihi = null;
    }

    const misafirler = await prisma.misafir.findMany({
      where,
      include: {
        oda: {
          select: {
            id: true,
            odaNumarasi: true,
            odaTipi: true
          }
        },
        bildirimler: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            durum: true,
            hataMesaji: true,
            createdAt: true
          }
        }
      },
      orderBy: { girisTarihi: 'desc' }
    });

    const maskelenmisMisafirler = misafirler.map(m => ({
      id: m.id,
      ad: m.ad,
      soyad: m.soyad,
      kimlikNo: kimlikGorebilir ? m.kimlikNo : maskKimlikNo(m.kimlikNo),
      pasaportNo: m.pasaportNo ? (kimlikGorebilir ? m.pasaportNo : maskPasaportNo(m.pasaportNo)) : null,
      dogumTarihi: m.dogumTarihi,
      uyruk: m.uyruk,
      girisTarihi: m.girisTarihi,
      cikisTarihi: m.cikisTarihi,
      oda: m.oda,
      sonBildirim: m.bildirimler[0] || null
    }));

    res.json({ misafirler: maskelenmisMisafirler });
  } catch (error) {
    console.error('Misafir listesi hatası:', error);
    res.status(500).json({ message: 'Misafirler alınamadı', error: error.message });
  }
});

/**
 * Check-in (Misafir girişi)
 */
router.post('/checkin', async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user.checkInYetki) {
      return res.status(403).json({ message: 'Check-in yetkiniz yok' });
    }

    const { odaId, ad, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk } = req.body;

    if (!odaId || !ad || !soyad || !dogumTarihi || !uyruk) {
      return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
    }

    if (!kimlikNo && !pasaportNo) {
      return res.status(400).json({ message: 'Kimlik veya pasaport numarası gerekli' });
    }

    // Oda kontrolü
    const oda = await prisma.oda.findFirst({
      where: {
        id: odaId,
        tesisId: req.tesis.id
      }
    });

    if (!oda) {
      return res.status(404).json({ message: 'Oda bulunamadı' });
    }

    if (oda.durum === 'dolu') {
      return res.status(400).json({ message: 'Oda dolu' });
    }

    const sendCheck = canSendBildirim(req.tesis);
    if (!sendCheck.allowed) {
      const message = sendCheck.reason === 'trial_ended'
        ? 'Deneme süren tamamlandı. Bildirimlerine kesintisiz devam etmek için paket seç.'
        : 'Bildirim hakkın doldu. Devam etmek için paket seç.';
      return res.status(402).json({ message, code: sendCheck.reason });
    }

    // Misafir oluştur
    const misafir = await prisma.misafir.create({
      data: {
        tesisId: req.tesis.id,
        odaId,
        ad,
        soyad,
        kimlikNo: kimlikNo || null,
        pasaportNo: pasaportNo || null,
        dogumTarihi: new Date(dogumTarihi),
        uyruk,
        girisTarihi: new Date()
      }
    });

    // Odayı dolu yap — tek kaynak: uygulama. Kim var kim yok buradan belli.
    await prisma.oda.update({
      where: { id: odaId },
      data: { durum: 'dolu' }
    });

    // Bildirim kaydını hemen oluştur (beklemede). KBS arka planda gönderilir — gecikme yok.
    const bildirim = await prisma.bildirim.create({
      data: {
        tesisId: req.tesis.id,
        misafirId: misafir.id,
        durum: 'beklemede',
        hataMesaji: null,
        kbsTuru: req.tesis.kbsTuru || null,
        kbsYanit: null
      }
    });

    const tesisSnapshot = req.tesis;
    if (tesisSnapshot.kbsTuru && tesisSnapshot.kbsTesisKodu && tesisSnapshot.kbsWebServisSifre) {
      setImmediate(async () => {
        try {
          const kbsService = createKBSService(tesisSnapshot);
          const kbsResult = await kbsService.bildirimGonder({
            ad: misafir.ad,
            soyad: misafir.soyad,
            kimlikNo: misafir.kimlikNo,
            pasaportNo: misafir.pasaportNo,
            dogumTarihi: misafir.dogumTarihi,
            uyruk: misafir.uyruk,
            girisTarihi: misafir.girisTarihi,
            odaNumarasi: oda.odaNumarasi
          });
          await prisma.bildirim.update({
            where: { id: bildirim.id },
            data: {
              durum: kbsResult.durum,
              hataMesaji: kbsResult.hataMesaji || null,
              denemeSayisi: { increment: 1 },
              sonDenemeTarihi: new Date(),
              kbsYanit: kbsResult.yanit ? JSON.stringify(kbsResult.yanit) : null
            }
          });
          if (kbsResult.success && tesisSnapshot.kullanilanKota < tesisSnapshot.kota) {
            await prisma.tesis.update({
              where: { id: tesisSnapshot.id },
              data: { kullanilanKota: { increment: 1 } }
            });
          }
        } catch (error) {
          await prisma.bildirim.update({
            where: { id: bildirim.id },
            data: {
              durum: 'hatali',
              hataMesaji: error.message,
              denemeSayisi: { increment: 1 },
              sonDenemeTarihi: new Date(),
              kbsYanit: JSON.stringify({ error: error.message })
            }
          });
          await prisma.hata.create({
            data: {
              tesisId: tesisSnapshot.id,
              bildirimId: bildirim.id,
              hataTipi: 'kbs-yanit',
              hataMesaji: error.message || 'Bildirim gönderilemedi',
              durum: 'acik'
            }
          });
        }
      });
    }

    // Log
    await prisma.log.create({
      data: {
        tesisId: req.tesis.id,
        kullaniciId: req.user.id,
        islem: 'check-in',
        detay: {
          odaNumarasi: oda.odaNumarasi,
          misafirId: misafir.id
        },
        basarili: true
      }
    });

    res.status(201).json({
      message: 'Kayıt alındı',
      misafir: {
        id: misafir.id,
        ad: misafir.ad,
        soyad: misafir.soyad
      },
      kbsBildirimi: {
        durum: 'beklemede',
        mesaj: req.tesis.kbsTuru ? 'Bildirim arka planda gönderiliyor' : 'KBS yapılandırılmamış'
      }
    });
  } catch (error) {
    console.error('Check-in hatası:', error);
    res.status(500).json({ message: 'Check-in başarısız', error: error.message });
  }
});

/**
 * Check-out (Misafir çıkışı)
 */
router.post('/checkout/:misafirId', async (req, res) => {
  try {
    const { misafirId } = req.params;

    const misafir = await prisma.misafir.findFirst({
      where: {
        id: misafirId,
        tesisId: req.tesis.id,
        cikisTarihi: null
      },
      include: {
        oda: true
      }
    });

    if (!misafir) {
      return res.status(404).json({ message: 'Aktif misafir bulunamadı' });
    }

    const cikisTarihi = new Date();

    // Çıkışı hemen kaydet — tek kaynak: uygulama. Gecikme yok.
    await prisma.misafir.update({
      where: { id: misafirId },
      data: { cikisTarihi }
    });

    await prisma.oda.update({
      where: { id: misafir.odaId },
      data: { durum: 'bos' }
    });

    const tesisForCikis = req.tesis;
    if (tesisForCikis.kbsTuru && tesisForCikis.kbsTesisKodu && tesisForCikis.kbsWebServisSifre) {
      const misafirCopy = { kimlikNo: misafir.kimlikNo, pasaportNo: misafir.pasaportNo };
      setImmediate(async () => {
        try {
          const kbsService = createKBSService(tesisForCikis);
          await kbsService.cikisBildir({
            ...misafirCopy,
            cikisTarihi
          });
        } catch (error) {
          console.error('KBS çıkış bildirimi hatası:', error);
        }
      });
    }

    // Log
    await prisma.log.create({
      data: {
        tesisId: req.tesis.id,
        kullaniciId: req.user.id,
        islem: 'check-out',
        detay: {
          odaNumarasi: misafir.oda.odaNumarasi,
          misafirId: misafir.id
        },
        basarili: true
      }
    });

    res.json({ message: 'Çıkış yapıldı' });
  } catch (error) {
    console.error('Check-out hatası:', error);
    res.status(500).json({ message: 'Çıkış başarısız', error: error.message });
  }
});

/**
 * Oda değiştir
 */
router.post('/oda-degistir/:misafirId', async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user.odaDegistirmeYetki) {
      return res.status(403).json({ message: 'Oda değiştirme yetkiniz yok' });
    }

    const { misafirId } = req.params;
    const { yeniOdaId } = req.body;

    if (!yeniOdaId) {
      return res.status(400).json({ message: 'Yeni oda seçilmedi' });
    }

    const misafir = await prisma.misafir.findFirst({
      where: {
        id: misafirId,
        tesisId: req.tesis.id,
        cikisTarihi: null
      },
      include: {
        oda: true
      }
    });

    if (!misafir) {
      return res.status(404).json({ message: 'Aktif misafir bulunamadı' });
    }

    const yeniOda = await prisma.oda.findFirst({
      where: {
        id: yeniOdaId,
        tesisId: req.tesis.id
      }
    });

    if (!yeniOda) {
      return res.status(404).json({ message: 'Yeni oda bulunamadı' });
    }

    if (yeniOda.durum === 'dolu') {
      return res.status(400).json({ message: 'Yeni oda dolu' });
    }

    const eskiOdaId = misafir.odaId;

    // Misafiri yeni odaya taşı
    await prisma.misafir.update({
      where: { id: misafirId },
      data: { odaId: yeniOdaId }
    });

    // Eski odayı boş yap
    await prisma.oda.update({
      where: { id: eskiOdaId },
      data: { durum: 'bos' }
    });

    // Yeni odayı dolu yap
    await prisma.oda.update({
      where: { id: yeniOdaId },
      data: { durum: 'dolu' }
    });

    // KBS oda değişikliği bildirimi
    if (req.tesis.kbsTuru && req.tesis.kbsTesisKodu && req.tesis.kbsWebServisSifre) {
      try {
        const kbsService = createKBSService(req.tesis);
        await kbsService.odaDegistir(
          {
            kimlikNo: misafir.kimlikNo,
            pasaportNo: misafir.pasaportNo,
            odaNumarasi: misafir.oda.odaNumarasi
          },
          yeniOda.odaNumarasi
        );
      } catch (error) {
        console.error('KBS oda değişikliği hatası:', error);
      }
    }

    // Log
    await prisma.log.create({
      data: {
        tesisId: req.tesis.id,
        kullaniciId: req.user.id,
        islem: 'oda-degistir',
        detay: {
          misafirId: misafir.id,
          eskiOda: misafir.oda.odaNumarasi,
          yeniOda: yeniOda.odaNumarasi
        },
        basarili: true
      }
    });

    res.json({ message: 'Oda değiştirildi' });
  } catch (error) {
    console.error('Oda değiştirme hatası:', error);
    res.status(500).json({ message: 'Oda değiştirilemedi', error: error.message });
  }
});

/**
 * Misafir bilgilerini güncelle
 */
router.put('/:misafirId', async (req, res) => {
  try {
    // Yetki kontrolü
    if (!req.user.bilgiDuzenlemeYetki) {
      return res.status(403).json({ message: 'Bilgi düzenleme yetkiniz yok' });
    }

    const { misafirId } = req.params;
    const { ad, soyad, dogumTarihi, uyruk } = req.body;

    const misafir = await prisma.misafir.findFirst({
      where: {
        id: misafirId,
        tesisId: req.tesis.id
      }
    });

    if (!misafir) {
      return res.status(404).json({ message: 'Misafir bulunamadı' });
    }

    const updateData = {};
    if (ad) updateData.ad = ad;
    if (soyad) updateData.soyad = soyad;
    if (dogumTarihi) updateData.dogumTarihi = new Date(dogumTarihi);
    if (uyruk) updateData.uyruk = uyruk;

    await prisma.misafir.update({
      where: { id: misafirId },
      data: updateData
    });

    // Log
    await prisma.log.create({
      data: {
        tesisId: req.tesis.id,
        kullaniciId: req.user.id,
        islem: 'misafir-guncelle',
        detay: { misafirId },
        basarili: true
      }
    });

    res.json({ message: 'Misafir bilgileri güncellendi' });
  } catch (error) {
    console.error('Misafir güncelleme hatası:', error);
    res.status(500).json({ message: 'Güncelleme başarısız', error: error.message });
  }
});

module.exports = router;

