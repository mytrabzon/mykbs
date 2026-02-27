const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { createKBSService } = require('../services/kbs');
const { supabaseAdmin } = require('../lib/supabaseAdmin');
const prisma = new PrismaClient();

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
      return res.json({
        tesis: { id: branch.id, tesisAdi: branch.name, kbsTuru: branch.kbs_turu },
        ozet: { toplamOda: 0, doluOda: 0, bugunGiris: 0, bugunCikis: 0, hataliBildirim: 0 }
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
    console.error('Tesis bilgisi hatası:', error);
    res.status(500).json({ message: 'Bilgi alınamadı', error: error.message });
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
    console.error('KBS ayarları hatası:', error);
    res.status(500).json({ message: 'Ayarlar alınamadı', error: error.message });
  }
});

/**
 * KBS ayarlarını güncelle (Supabase: branches; Prisma: tesis)
 */
router.put('/kbs', async (req, res) => {
  try {
    const { kbsTuru, kbsTesisKodu, kbsWebServisSifre, ipKisitAktif, ipAdresleri } = req.body;

    if (req.authSource === 'supabase') {
      if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
      const updateData = {};
      if (kbsTuru !== undefined) updateData.kbs_turu = kbsTuru;
      if (kbsTesisKodu !== undefined) updateData.kbs_tesis_kodu = kbsTesisKodu;
      if (kbsWebServisSifre !== undefined) updateData.kbs_web_servis_sifre = kbsWebServisSifre;
      if (Object.keys(updateData).length === 0) return res.json({ message: 'KBS ayarları güncellendi' });
      const { error } = await supabaseAdmin.from('branches').update(updateData).eq('id', req.branchId).select().single();
      if (error) return res.status(500).json({ message: 'Ayarlar güncellenemedi', error: error.message });
      return res.json({ message: 'KBS ayarları güncellendi' });
    }

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
      if (!supabaseAdmin) return res.status(503).json({ message: 'Supabase yapılandırılmamış' });
      const { error } = await supabaseAdmin.from('audit_logs').insert({
        branch_id: req.branchId,
        user_id: req.user.id,
        action,
        entity: 'kbs_settings',
        meta_json: { type, status: 'pending' }
      });
      if (error) return res.status(500).json({ message: 'Talep kaydedilemedi', error: error.message });
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
    console.error('KBS talep hatası:', error);
    res.status(500).json({ message: 'Talep gönderilemedi', error: error.message });
  }
});

router.post('/kbs/test', async (req, res) => {
  try {
    let tesisLike;
    if (req.authSource === 'supabase') {
      const b = req.branch;
      if (!b.kbs_turu || !b.kbs_tesis_kodu || !b.kbs_web_servis_sifre) {
        return res.status(400).json({ message: 'KBS bilgileri eksik' });
      }
      tesisLike = { kbsTuru: b.kbs_turu, kbsTesisKodu: b.kbs_tesis_kodu, kbsWebServisSifre: b.kbs_web_servis_sifre, ipAdresleri: [] };
    } else {
      const tesis = await prisma.tesis.findUnique({ where: { id: req.tesis.id } });
      if (!tesis || !tesis.kbsTuru || !tesis.kbsTesisKodu || !tesis.kbsWebServisSifre) {
        return res.status(400).json({ message: 'KBS bilgileri eksik' });
      }
      tesisLike = tesis;
    }

    const kbsService = createKBSService(tesisLike);
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

