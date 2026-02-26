const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { createKBSService } = require('../services/kbs');
const prisma = new PrismaClient();

const router = express.Router();

// Tüm tesis rotaları authentication gerektirir
router.use(authenticate);

/**
 * Tesis bilgilerini getir
 */
router.get('/', async (req, res) => {
  try {
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
    console.error('Tesis bilgisi hatası:', error);
    res.status(500).json({ message: 'Bilgi alınamadı', error: error.message });
  }
});

/**
 * KBS ayarlarını getir
 */
router.get('/kbs', async (req, res) => {
  try {
    const tesis = await prisma.tesis.findUnique({
      where: { id: req.tesis.id },
      select: {
        kbsTuru: true,
        kbsTesisKodu: true,
        ipKisitAktif: true,
        ipAdresleri: true
        // Şifre güvenlik nedeniyle gönderilmez
        // NOT: IP kısıtlaması varsayılan olarak kapalı (false)
      }
    });

    res.json(tesis);
  } catch (error) {
    console.error('KBS ayarları hatası:', error);
    res.status(500).json({ message: 'Ayarlar alınamadı', error: error.message });
  }
});

/**
 * KBS ayarlarını güncelle
 */
router.put('/kbs', async (req, res) => {
  try {
    const { kbsTuru, kbsTesisKodu, kbsWebServisSifre, ipKisitAktif, ipAdresleri } = req.body;

    // Rol kontrolü (sadece sahip/yönetici)
    if (!['sahip', 'yonetici'].includes(req.user.rol)) {
      return res.status(403).json({ message: 'Bu işlem için yetkiniz yok' });
    }

    const updateData = {};
    if (kbsTuru) updateData.kbsTuru = kbsTuru;
    if (kbsTesisKodu) updateData.kbsTesisKodu = kbsTesisKodu;
    if (kbsWebServisSifre) updateData.kbsWebServisSifre = kbsWebServisSifre;
    if (ipKisitAktif !== undefined) updateData.ipKisitAktif = ipKisitAktif;
    if (ipAdresleri) updateData.ipAdresleri = ipAdresleri;

    const tesis = await prisma.tesis.update({
      where: { id: req.tesis.id },
      data: updateData
    });

    // Audit log
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
    console.error('KBS ayar güncelleme hatası:', error);
    res.status(500).json({ message: 'Ayarlar güncellenemedi', error: error.message });
  }
});

/**
 * KBS bağlantı testi
 */
router.post('/kbs/test', async (req, res) => {
  try {
    const tesis = await prisma.tesis.findUnique({
      where: { id: req.tesis.id }
    });

    if (!tesis.kbsTuru || !tesis.kbsTesisKodu || !tesis.kbsWebServisSifre) {
      return res.status(400).json({ message: 'KBS bilgileri eksik' });
    }

    const kbsService = createKBSService(tesis);
    const testResult = await kbsService.testBaglanti();

    res.json(testResult);
  } catch (error) {
    console.error('KBS test hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Test başarısız' 
    });
  }
});

module.exports = router;

