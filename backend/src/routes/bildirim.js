const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { errorResponse } = require('../lib/errorResponse');
const { createKBSService } = require('../services/kbs');
const { canSendBildirim } = require('../config/packages');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.use(authenticateTesisOrSupabase);

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis.id;
}

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
 * Bildirimleri listele
 */
router.get('/', async (req, res) => {
  try {
    const { durum, limit = 50, offset = 0 } = req.query;
    const tesisId = getTesisId(req);
    const where = { tesisId };
    if (durum) {
      where.durum = durum;
    }

    const bildirimler = await prisma.bildirim.findMany({
      where,
      include: {
        misafir: {
          select: {
            id: true,
            ad: true,
            soyad: true,
            kimlikNo: true,
            pasaportNo: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });

    res.json({ bildirimler });
  } catch (error) {
    console.error('Bildirim listesi hatası:', error);
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Bildirimler alınamadı.');
  }
});

/**
 * Toplu bildirim gönder (seçili misafirler için)
 */
router.post('/toplu-gonder', async (req, res) => {
  try {
    const { misafirIds, misafirTipi } = req.body; // misafirIds: array; misafirTipi: tc_vatandasi | ykn | yabanci (tek sefer, hepsine uygulanır)

    if (!misafirIds || !Array.isArray(misafirIds) || misafirIds.length === 0) {
      return res.status(400).json({ message: 'Misafir ID\'leri gerekli' });
    }

    const tesisKbs = getTesisOrBranch(req);
    if (!tesisKbs.kbsTuru || !tesisKbs.kbsTesisKodu || !tesisKbs.kbsWebServisSifre) {
      return res.status(400).json({ message: 'KBS ayarları eksik' });
    }

    const sendCheck = canSendBildirim(tesisKbs);
    if (!sendCheck.allowed) {
      const message = sendCheck.reason === 'trial_ended'
        ? 'Deneme süren tamamlandı. Bildirimlerine kesintisiz devam etmek için paket seç.'
        : 'Bildirim hakkın doldu. Devam etmek için paket seç.';
      return res.status(402).json({ message, code: sendCheck.reason });
    }

    // Seçili misafirleri getir
    const misafirler = await prisma.misafir.findMany({
      where: {
        id: { in: misafirIds },
        tesisId: getTesisId(req),
        cikisTarihi: null // Sadece aktif misafirler
      },
      include: {
        oda: true,
        bildirimler: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (misafirler.length === 0) {
      return res.status(404).json({ message: 'Aktif misafir bulunamadı' });
    }

    const kbsService = createKBSService(getTesisOrBranch(req));
    const sonuclar = [];

    // Her misafir için bildirim gönder
    for (const misafir of misafirler) {
      try {
        const kbsResult = await kbsService.bildirimGonder({
          ad: misafir.ad,
          ad2: misafir.ad2 || null,
          soyad: misafir.soyad,
          kimlikNo: misafir.kimlikNo,
          pasaportNo: misafir.pasaportNo,
          dogumTarihi: misafir.dogumTarihi,
          uyruk: misafir.uyruk,
          misafirTipi: misafirTipi || misafir.misafirTipi || null,
          girisTarihi: misafir.girisTarihi,
          odaNumarasi: misafir.oda.odaNumarasi
        });

        // Bildirim kaydı oluştur veya güncelle
        const mevcutBildirim = misafir.bildirimler[0];
        if (mevcutBildirim) {
          await prisma.bildirim.update({
            where: { id: mevcutBildirim.id },
            data: {
              durum: kbsResult.durum,
              hataMesaji: kbsResult.hataMesaji || null,
              denemeSayisi: { increment: 1 },
              sonDenemeTarihi: new Date(),
              kbsYanit: kbsResult.yanit || null
            }
          });
        } else {
          await prisma.bildirim.create({
            data: {
              tesisId: getTesisId(req),
              misafirId: misafir.id,
              durum: kbsResult.durum,
              hataMesaji: kbsResult.hataMesaji || null,
              kbsTuru: getTesisOrBranch(req).kbsTuru,
              kbsYanit: kbsResult.yanit || null
            }
          });
        }

        // Kota kontrolü (sadece Prisma tesis; Supabase’de kota ayrı yönetilir)
        const t = getTesisOrBranch(req);
        if (kbsResult.success && req.authSource !== 'supabase' && t.kullanilanKota < t.kota) {
          await prisma.tesis.update({
            where: { id: t.id },
            data: { kullanilanKota: { increment: 1 } }
          });
        }

        sonuclar.push({
          misafirId: misafir.id,
          ad: misafir.ad,
          soyad: misafir.soyad,
          odaNumarasi: misafir.oda.odaNumarasi,
          durum: kbsResult.durum,
          basarili: kbsResult.success,
          hataMesaji: kbsResult.hataMesaji || null
        });
      } catch (error) {
        sonuclar.push({
          misafirId: misafir.id,
          ad: misafir.ad,
          soyad: misafir.soyad,
          odaNumarasi: misafir.oda.odaNumarasi,
          durum: 'hatali',
          basarili: false,
          hataMesaji: error.message
        });
      }
    }

    const basariliSayisi = sonuclar.filter(r => r.basarili).length;
    const hataliSayisi = sonuclar.filter(r => !r.basarili).length;

    res.json({
      message: `Toplu bildirim tamamlandı: ${basariliSayisi} başarılı, ${hataliSayisi} hatalı`,
      toplam: sonuclar.length,
      basarili: basariliSayisi,
      hatali: hataliSayisi,
      sonuclar
    });
  } catch (error) {
    console.error('Toplu bildirim hatası:', error);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'Toplu bildirim başarısız');
  }
});

/**
 * Bildirimi tekrar dene
 */
router.post('/:bildirimId/tekrar-dene', async (req, res) => {
  try {
    const { bildirimId } = req.params;

    const bildirim = await prisma.bildirim.findFirst({
      where: {
        id: bildirimId,
        tesisId: getTesisId(req)
      },
      include: {
        misafir: {
          include: {
            oda: true
          }
        }
      }
    });

    if (!bildirim) {
      return res.status(404).json({ message: 'Bildirim bulunamadı' });
    }

    const tesisForRetry = getTesisOrBranch(req);
    if (tesisForRetry.kbsTuru && tesisForRetry.kbsTesisKodu && tesisForRetry.kbsWebServisSifre) {
      try {
        const kbsService = createKBSService(tesisForRetry);
        const kbsResult = await kbsService.bildirimGonder({
          ad: bildirim.misafir.ad,
          ad2: bildirim.misafir.ad2 || null,
          soyad: bildirim.misafir.soyad,
          kimlikNo: bildirim.misafir.kimlikNo,
          pasaportNo: bildirim.misafir.pasaportNo,
          dogumTarihi: bildirim.misafir.dogumTarihi,
          uyruk: bildirim.misafir.uyruk,
          misafirTipi: bildirim.misafir.misafirTipi || null,
          girisTarihi: bildirim.misafir.girisTarihi,
          odaNumarasi: bildirim.misafir.oda.odaNumarasi
        });

        await prisma.bildirim.update({
          where: { id: bildirimId },
          data: {
            durum: kbsResult.durum,
            hataMesaji: kbsResult.hataMesaji || null,
            denemeSayisi: { increment: 1 },
            sonDenemeTarihi: new Date(),
            kbsYanit: kbsResult.yanit || null
          }
        });

        res.json({
          message: 'Bildirim tekrar denendi',
          durum: kbsResult.durum
        });
      } catch (error) {
        await prisma.bildirim.update({
          where: { id: bildirimId },
          data: {
            durum: 'hatali',
            hataMesaji: error.message,
            denemeSayisi: { increment: 1 },
            sonDenemeTarihi: new Date()
          }
        });

        return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'Bildirim gönderilemedi');
      }
    } else {
      res.status(400).json({ message: 'KBS ayarları eksik' });
    }
  } catch (error) {
    console.error('Tekrar deneme hatası:', error);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'İşlem başarısız');
  }
});

/**
 * Misafir bildirimi için PDF oluştur
 */
router.get('/:bildirimId/pdf', async (req, res) => {
  try {
    const { bildirimId } = req.params;

    const bildirim = await prisma.bildirim.findFirst({
      where: {
        id: bildirimId,
        tesisId: getTesisId(req)
      },
      include: {
        misafir: {
          include: {
            oda: true
          }
        },
        tesis: {
          select: {
            tesisAdi: true,
            adres: true,
            telefon: true,
            email: true
          }
        }
      }
    });

    if (!bildirim) {
      return res.status(404).json({ message: 'Bildirim bulunamadı' });
    }

    // PDF oluştur
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bildirim_${bildirimId}.pdf"`);

    // PDF'i response'a pipe et
    doc.pipe(res);

    // Tesis bilgileri (Prisma tesis veya Supabase branch)
    const tesisBilgi = bildirim.tesis || (req.branch ? { tesisAdi: req.branch.name, adres: '', telefon: '', email: '' } : { tesisAdi: 'Tesis', adres: '', telefon: '', email: '' });
    doc.fontSize(16).font('Helvetica-Bold').text(tesisBilgi.tesisAdi, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(tesisBilgi.adres || '', { align: 'center' });
    doc.text(`Tel: ${tesisBilgi.telefon || ''} | Email: ${tesisBilgi.email || ''}`, { align: 'center' });
    doc.moveDown(1);

    // Başlık
    doc.fontSize(14).font('Helvetica-Bold').text('KBS BİLDİRİM BELGESİ', { align: 'center' });
    doc.moveDown(1);

    // Çizgi
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    // Misafir bilgileri
    doc.fontSize(12).font('Helvetica-Bold').text('MİSAFİR BİLGİLERİ', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    doc.text(`Ad Soyad: ${bildirim.misafir.ad} ${bildirim.misafir.soyad}`);
    doc.text(`Oda Numarası: ${bildirim.misafir.oda.odaNumarasi}`);
    doc.text(`Uyruk: ${bildirim.misafir.uyruk}`);
    doc.text(`Doğum Tarihi: ${new Date(bildirim.misafir.dogumTarihi).toLocaleDateString('tr-TR')}`);
    doc.text(`Giriş Tarihi: ${new Date(bildirim.misafir.girisTarihi).toLocaleDateString('tr-TR')}`);
    
    if (bildirim.misafir.kimlikNo) {
      // Maskeli göster
      const maskedKimlik = bildirim.misafir.kimlikNo.replace(/(\d{3})(\d{5})(\d{3})/, '$1*****$3');
      doc.text(`TC Kimlik No: ${maskedKimlik}`);
    }
    if (bildirim.misafir.pasaportNo) {
      // Maskeli göster
      const maskedPasaport = bildirim.misafir.pasaportNo.replace(/(.{2})(.{4})(.*)/, '$1****$3');
      doc.text(`Pasaport No: ${maskedPasaport}`);
    }

    doc.moveDown(1);

    // Bildirim bilgileri
    doc.fontSize(12).font('Helvetica-Bold').text('BİLDİRİM BİLGİLERİ', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    
    doc.text(`KBS Türü: ${bildirim.kbsTuru === 'jandarma' ? 'Jandarma' : 'Polis'}`);
    doc.text(`Durum: ${bildirim.durum === 'basarili' ? 'Başarılı' : bildirim.durum === 'hatali' ? 'Hatalı' : 'Beklemede'}`);
    doc.text(`Oluşturulma Tarihi: ${new Date(bildirim.createdAt).toLocaleDateString('tr-TR')} ${new Date(bildirim.createdAt).toLocaleTimeString('tr-TR')}`);
    
    if (bildirim.hataMesaji) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Hata Mesajı:', { underline: true });
      doc.font('Helvetica').text(bildirim.hataMesaji);
    }

    if (bildirim.denemeSayisi > 0) {
      doc.text(`Deneme Sayısı: ${bildirim.denemeSayisi}`);
      if (bildirim.sonDenemeTarihi) {
        doc.text(`Son Deneme: ${new Date(bildirim.sonDenemeTarihi).toLocaleDateString('tr-TR')} ${new Date(bildirim.sonDenemeTarihi).toLocaleTimeString('tr-TR')}`);
      }
    }

    doc.moveDown(2);

    // Alt bilgi
    doc.fontSize(8).font('Helvetica').text(
      `Bu belge ${new Date().toLocaleDateString('tr-TR')} tarihinde oluşturulmuştur.`,
      { align: 'center' }
    );

    // PDF'i bitir
    doc.end();
  } catch (error) {
    console.error('PDF oluşturma hatası:', error);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', error?.message || 'PDF oluşturulamadı');
  }
});

module.exports = router;

