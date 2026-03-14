const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { createKBSService } = require('../services/kbs');
const { maskKimlikNo, maskPasaportNo } = require('../utils/mask');
const { canSendBildirim } = require('../config/packages');

const router = express.Router();

router.use(authenticateTesisOrSupabase);

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis.id;
}

/** KBS / paket kontrolleri için tesis veya branch (Supabase’de tesis-benzeri nesne). */
function getTesisOrBranch(req) {
  if (req.authSource === 'supabase' && req.branch) {
    return {
      id: req.branch.id,
      kbsTuru: req.branch.kbs_turu || null,
      kbsTesisKodu: req.branch.kbs_tesis_kodu || null,
      kbsWebServisSifre: req.branch.kbs_web_servis_sifre || null,
      ipAdresleri: req.branch.ipAdresleri || [],
      paket: 'deneme',
      kota: 1000,
      kullanilanKota: 0,
      trialEndsAt: null
    };
  }
  return req.tesis;
}

/**
 * Aktif misafirleri listele
 */
router.get('/', async (req, res) => {
  try {
    const { cikisYapmis, tam } = req.query;
    const kimlikGorebilir = tam === '1' && (req.authSource === 'supabase' || ['sahip', 'yonetici'].includes(req.user.rol));
    const tesisId = getTesisId(req);
    const where = { tesisId };

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
      ad2: m.ad2 || null,
      anaAdi: m.anaAdi || null,
      soyad: m.soyad,
      kimlikNo: kimlikGorebilir ? m.kimlikNo : maskKimlikNo(m.kimlikNo),
      pasaportNo: m.pasaportNo ? (kimlikGorebilir ? m.pasaportNo : maskPasaportNo(m.pasaportNo)) : null,
      dogumTarihi: m.dogumTarihi,
      uyruk: m.uyruk,
      misafirTipi: m.misafirTipi || null,
      girisTarihi: m.girisTarihi,
      cikisTarihi: m.cikisTarihi,
      email: m.email || null,
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
    if (req.authSource !== 'supabase' && !req.user.checkInYetki) {
      return res.status(403).json({ message: 'Check-in yetkiniz yok' });
    }

    const { odaId, ad, ad2, anaAdi, soyad, kimlikNo, pasaportNo, dogumTarihi, uyruk, misafirTipi } = req.body;
    const tesisId = getTesisId(req);

    if (!odaId || !ad || !soyad || !dogumTarihi || !uyruk) {
      return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
    }

    if (!kimlikNo && !pasaportNo) {
      return res.status(400).json({ message: 'Kimlik veya pasaport numarası gerekli' });
    }

    const oda = await prisma.oda.findFirst({
      where: { id: odaId, tesisId }
    });

    if (!oda) {
      return res.status(404).json({ message: 'Oda bulunamadı' });
    }

    if (oda.durum === 'dolu') {
      return res.status(400).json({ message: 'Oda dolu' });
    }

    const sendCheck = canSendBildirim(getTesisOrBranch(req));
    if (!sendCheck.allowed) {
      const message = sendCheck.reason === 'trial_ended'
        ? 'Deneme süren tamamlandı. Bildirimlerine kesintisiz devam etmek için paket seç.'
        : 'Bildirim hakkın doldu. Devam etmek için paket seç.';
      return res.status(402).json({ message, code: sendCheck.reason });
    }

    // Misafir oluştur
    const misafir = await prisma.misafir.create({
      data: {
        tesisId,
        odaId,
        ad,
        ad2: ad2 || null,
        anaAdi: anaAdi || null,
        soyad,
        kimlikNo: kimlikNo || null,
        pasaportNo: pasaportNo || null,
        dogumTarihi: new Date(dogumTarihi),
        uyruk,
        misafirTipi: misafirTipi || null,
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
        tesisId: getTesisId(req),
        misafirId: misafir.id,
        durum: 'beklemede',
        hataMesaji: null,
        kbsTuru: getTesisOrBranch(req).kbsTuru || null,
        kbsYanit: null
      }
    });

    const tesisSnapshot = getTesisOrBranch(req);
    if (tesisSnapshot.kbsTuru && tesisSnapshot.kbsTesisKodu && tesisSnapshot.kbsWebServisSifre) {
      setImmediate(async () => {
        try {
          const kbsService = createKBSService(tesisSnapshot);
          const kbsResult = await kbsService.bildirimGonder({
            ad: misafir.ad,
            ad2: misafir.ad2 || null,
            anaAdi: misafir.anaAdi || null,
            soyad: misafir.soyad,
            kimlikNo: misafir.kimlikNo,
            pasaportNo: misafir.pasaportNo,
            dogumTarihi: misafir.dogumTarihi,
            uyruk: misafir.uyruk,
            misafirTipi: misafir.misafirTipi || null,
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
        tesisId,
        kullaniciId: req.user.id,
        islem: 'check-in',
        detay: JSON.stringify({
          odaNumarasi: oda.odaNumarasi,
          misafirId: misafir.id
        }),
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
        mesaj: getTesisOrBranch(req).kbsTuru ? 'Bildirim arka planda gönderiliyor' : 'KBS yapılandırılmamış'
      }
    });
  } catch (error) {
    console.error('Check-in hatası:', error);
    res.status(500).json({ message: 'Check-in başarısız', error: error.message });
  }
});

/**
 * Manuel bilgi ile KBS'ye bildirim (belge okutmadan)
 * Body: kimlikNo veya pasaportNo, ad, soyad, babaAdi, anaAdi, dogumTarihi, uyruk, odaNumarasi,
 *       misafirTipi?, girisTarihi? (yoksa bildirildiği tarih kullanılır), telefon?, plaka?
 */
router.post('/manuel-bildirim', async (req, res) => {
  try {
    if (req.authSource !== 'supabase' && !req.user.checkInYetki) {
      return res.status(403).json({ message: 'Check-in yetkiniz yok' });
    }

    const {
      kimlikNo,
      pasaportNo,
      ad,
      soyad,
      babaAdi,
      anaAdi,
      dogumTarihi,
      uyruk,
      odaNumarasi,
      misafirTipi,
      girisTarihi,
      telefon,
      plaka
    } = req.body;

    const tesisId = getTesisId(req);

    if (!ad || !soyad || !dogumTarihi || !uyruk || !odaNumarasi) {
      return res.status(400).json({ message: 'Ad, soyad, doğum tarihi, uyruk ve oda no zorunludur' });
    }
    if (!(babaAdi || '').trim()) {
      return res.status(400).json({ message: 'Baba adı zorunludur' });
    }
    if (!(anaAdi || '').trim()) {
      return res.status(400).json({ message: 'Ana adı zorunludur' });
    }

    if (!kimlikNo && !pasaportNo) {
      return res.status(400).json({ message: 'Kimlik veya pasaport numarası gerekli' });
    }

    const odaNoTrim = String(odaNumarasi || '').trim();
    if (!odaNoTrim) {
      return res.status(400).json({ message: 'Oda numarası girin' });
    }

    const oda = await prisma.oda.findFirst({
      where: { tesisId, odaNumarasi: odaNoTrim }
    });

    if (!oda) {
      return res.status(404).json({ message: 'Bu oda numarası tesisinizde bulunamadı' });
    }

    if (oda.durum === 'dolu') {
      return res.status(400).json({ message: 'Oda dolu' });
    }

    const sendCheck = canSendBildirim(getTesisOrBranch(req));
    if (!sendCheck.allowed) {
      const message = sendCheck.reason === 'trial_ended'
        ? 'Deneme süren tamamlandı. Bildirimlerine kesintisiz devam etmek için paket seç.'
        : 'Bildirim hakkın doldu. Devam etmek için paket seç.';
      return res.status(402).json({ message, code: sendCheck.reason });
    }

    const girisTarihiVal = girisTarihi ? new Date(girisTarihi) : new Date();

    const misafir = await prisma.misafir.create({
      data: {
        tesisId,
        odaId: oda.id,
        ad,
        ad2: String(babaAdi).trim() || null,
        anaAdi: (anaAdi || '').trim() || null,
        soyad,
        kimlikNo: kimlikNo ? String(kimlikNo).trim() || null : null,
        pasaportNo: pasaportNo ? String(pasaportNo).trim() || null : null,
        dogumTarihi: new Date(dogumTarihi),
        uyruk: String(uyruk).trim(),
        misafirTipi: misafirTipi || null,
        girisTarihi: girisTarihiVal
      }
    });

    await prisma.oda.update({
      where: { id: oda.id },
      data: { durum: 'dolu' }
    });

    const tesisSnapshot = getTesisOrBranch(req);
    const bildirim = await prisma.bildirim.create({
      data: {
        tesisId,
        misafirId: misafir.id,
        durum: 'beklemede',
        hataMesaji: null,
        kbsTuru: tesisSnapshot.kbsTuru || 'jandarma',
        kbsYanit: null
      }
    });

    if (tesisSnapshot.kbsTuru && tesisSnapshot.kbsTesisKodu && tesisSnapshot.kbsWebServisSifre) {
      setImmediate(async () => {
        try {
          const kbsService = createKBSService(tesisSnapshot);
          const kbsResult = await kbsService.bildirimGonder({
            ad: misafir.ad,
            ad2: misafir.ad2 || null,
            anaAdi: misafir.anaAdi || null,
            soyad: misafir.soyad,
            kimlikNo: misafir.kimlikNo,
            pasaportNo: misafir.pasaportNo,
            dogumTarihi: misafir.dogumTarihi,
            uyruk: misafir.uyruk,
            misafirTipi: misafir.misafirTipi || null,
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

    const logDetay = { odaNumarasi: oda.odaNumarasi, misafirId: misafir.id, manuel: true };
    if (telefon) logDetay.telefon = String(telefon).trim();
    if (plaka) logDetay.plaka = String(plaka).trim();

    await prisma.log.create({
      data: {
        tesisId,
        kullaniciId: req.user?.id,
        islem: 'manuel-bildirim',
        detay: JSON.stringify(logDetay),
        basarili: true
      }
    });

    res.status(201).json({
      message: 'Manuel bildirim alındı',
      misafir: {
        id: misafir.id,
        ad: misafir.ad,
        soyad: misafir.soyad
      },
      kbsBildirimi: {
        durum: 'beklemede',
        mesaj: getTesisOrBranch(req).kbsTuru ? 'Bildirim arka planda gönderiliyor' : 'KBS yapılandırılmamış'
      }
    });
  } catch (error) {
    console.error('Manuel bildirim hatası:', error);
    res.status(500).json({ message: 'Manuel bildirim başarısız', error: error.message });
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
        tesisId: getTesisId(req),
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

    const tesisForCikis = getTesisOrBranch(req);
    if (tesisForCikis.kbsTuru && tesisForCikis.kbsTesisKodu && tesisForCikis.kbsWebServisSifre) {
      const misafirCopy = {
        kimlikNo: misafir.kimlikNo || null,
        pasaportNo: misafir.pasaportNo || null,
        cikisTarihi: cikisTarihi.toISOString ? cikisTarihi.toISOString() : String(cikisTarihi)
      };
      setImmediate(async () => {
        try {
          const kbsService = createKBSService(tesisForCikis);
          await kbsService.cikisBildir(misafirCopy);
        } catch (error) {
          console.error('KBS çıkış bildirimi hatası:', error);
        }
      });
    }

    // Log
    await prisma.log.create({
      data: {
        tesisId: getTesisId(req),
        kullaniciId: req.user.id,
        islem: 'check-out',
        detay: JSON.stringify({
          odaNumarasi: misafir.oda.odaNumarasi,
          misafirId: misafir.id
        }),
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
    if (req.authSource !== 'supabase' && !req.user.odaDegistirmeYetki) {
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
        tesisId: getTesisId(req),
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
        tesisId: getTesisId(req)
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
    const tesisKbs = getTesisOrBranch(req);
    if (tesisKbs.kbsTuru && tesisKbs.kbsTesisKodu && tesisKbs.kbsWebServisSifre) {
      try {
        const kbsService = createKBSService(tesisKbs);
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
        tesisId: getTesisId(req),
        kullaniciId: req.user.id,
        islem: 'oda-degistir',
        detay: JSON.stringify({
          misafirId: misafir.id,
          eskiOda: misafir.oda.odaNumarasi,
          yeniOda: yeniOda.odaNumarasi
        }),
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
    if (req.authSource !== 'supabase' && !req.user.bilgiDuzenlemeYetki) {
      return res.status(403).json({ message: 'Bilgi düzenleme yetkiniz yok' });
    }

    const { misafirId } = req.params;
    const { ad, ad2, anaAdi, soyad, dogumTarihi, uyruk, misafirTipi, email } = req.body;

    const misafir = await prisma.misafir.findFirst({
      where: {
        id: misafirId,
        tesisId: getTesisId(req)
      }
    });

    if (!misafir) {
      return res.status(404).json({ message: 'Misafir bulunamadı' });
    }

    const updateData = {};
    if (ad !== undefined) updateData.ad = ad;
    if (ad2 !== undefined) updateData.ad2 = ad2 || null;
    if (anaAdi !== undefined) updateData.anaAdi = anaAdi || null;
    if (soyad !== undefined) updateData.soyad = soyad;
    if (dogumTarihi !== undefined) updateData.dogumTarihi = new Date(dogumTarihi);
    if (uyruk !== undefined) updateData.uyruk = uyruk;
    if (misafirTipi !== undefined) updateData.misafirTipi = misafirTipi || null;
    if (email !== undefined) updateData.email = email && String(email).trim() ? String(email).trim() : null;

    await prisma.misafir.update({
      where: { id: misafirId },
      data: updateData
    });

    // Log
    await prisma.log.create({
      data: {
        tesisId: getTesisId(req),
        kullaniciId: req.user.id,
        islem: 'misafir-guncelle',
        detay: JSON.stringify({ misafirId }),
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

