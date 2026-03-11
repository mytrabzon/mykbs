const express = require('express');
const { prisma } = require('../lib/prisma');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { errorResponse } = require('../lib/errorResponse');
const { getMaliyeRaporData, getVergiOzeti, formatDateTR, formatTimeTR } = require('../services/maliyeRaporService');

const router = express.Router();

router.use(authenticateTesisOrSupabase);

function getTesisId(req) {
  return req.authSource === 'supabase' ? req.branchId : req.tesis.id;
}

/**
 * Rapor özeti: doluluk, aktif misafir, bu ay giriş, ortalama kalış.
 * GET /api/rapor
 */
router.get('/', async (req, res) => {
  try {
    const tesisId = getTesisId(req);

    const [odalar, aktifMisafirSayisi, buAyGiren, cikisYapmisMisafirler] = await Promise.all([
      prisma.oda.findMany({
        where: { tesisId },
        select: { id: true, durum: true },
      }),
      prisma.misafir.count({
        where: { tesisId, cikisTarihi: null },
      }),
      prisma.misafir.count({
        where: {
          tesisId,
          girisTarihi: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
          },
        },
      }),
      prisma.misafir.findMany({
        where: { tesisId, cikisTarihi: { not: null } },
        select: { girisTarihi: true, cikisTarihi: true },
      }),
    ]);

    const toplamOda = odalar.length;
    const doluOda = odalar.filter((o) => o.durum === 'dolu').length;
    const dolulukOrani = toplamOda > 0 ? Math.round((doluOda / toplamOda) * 100) : 0;

    let ortalamaKalısGun = null;
    if (cikisYapmisMisafirler.length > 0) {
      const toplamGun = cikisYapmisMisafirler.reduce((acc, m) => {
        const giris = new Date(m.girisTarihi).getTime();
        const cikis = new Date(m.cikisTarihi).getTime();
        return acc + (cikis - giris) / (1000 * 60 * 60 * 24);
      }, 0);
      ortalamaKalısGun = Math.round((toplamGun / cikisYapmisMisafirler.length) * 10) / 10;
    }

    res.json({
      toplamOda,
      doluOda,
      dolulukOrani,
      aktifMisafirSayisi,
      buAyYeniMisafir: buAyGiren,
      ortalamaKalısGun,
    });
  } catch (error) {
    const msg = error?.message || '';
    const isSchema = /column|relation|does not exist|no such column/i.test(msg);
    const isDb = /prisma|ECONNREFUSED|connect|migrate|relation|column|table/i.test(msg);
    if (isSchema) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen yöneticiye bildirin.');
    if (isDb) return errorResponse(req, res, 500, 'DB_CONNECT_ERROR', 'Sunucuda geçici bir sorun var. Daha sonra tekrar deneyin.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Rapor alınamadı.');
  }
});

/**
 * Maliye Bakanlığı rapor verisi (JSON).
 * GET /api/rapor/maliye?type=doluluk|aylik|musteri|kbs|vergi&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/maliye', async (req, res) => {
  try {
    const type = (req.query.type || 'doluluk').toLowerCase();
    const from = req.query.from || '';
    const to = req.query.to || '';
    const data = await getMaliyeRaporData(req, from || undefined, to || undefined);
    if (!data) {
      return errorResponse(req, res, 500, 'RAPOR_ALINAMADI', 'Maliye rapor verisi alınamadı.');
    }
    const vergi = getVergiOzeti(data, 0);
    const payload = {
      tesis: data.tesis,
      donem: { from: from || formatDateTR(new Date()), to: to || formatDateTR(new Date()) },
      raporNo: data.raporNo,
      duzenlenmeTarihi: data.düzenlenmeTarihi,
      doluluk: type === 'doluluk' || type === 'aylik' ? { toplamOda: data.toplamOda, doluOda: data.doluOda, dolulukOrani: data.dolulukOrani } : undefined,
      aylikOzet: type === 'aylik' ? { toplamBildirim: data.toplamBildirim, tcVatandas: data.tcVatandas, yabanci: data.yabanci, uyrukDagilimi: data.uyrukDagilimi, konaklamaSuresi: data.konaklamaSuresi } : undefined,
      musteriListe: type === 'musteri' ? data.misafirler : undefined,
      kbsOzet: type === 'kbs' ? { toplamBildirim: data.toplamBildirim, tcVatandas: data.tcVatandas, yabanci: data.yabanci, uyrukDagilimi: data.uyrukDagilimi } : undefined,
      vergi: type === 'vergi' ? vergi : undefined,
      full: data,
    };
    res.json(payload);
  } catch (error) {
    console.error('[rapor/maliye]', error);
    const msg = error?.message || '';
    if (/column|relation|does not exist/i.test(msg)) return errorResponse(req, res, 500, 'SCHEMA_ERROR', 'Veritabanı şeması güncel değil. Lütfen migrasyon 0032 uygulayın.');
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Maliye raporu alınamadı.');
  }
});

/**
 * Maliye raporu HTML (PDF veya yazdır için).
 * GET /api/rapor/maliye/html?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/maliye/html', async (req, res) => {
  try {
    const from = req.query.from || '';
    const to = req.query.to || '';
    const data = await getMaliyeRaporData(req, from || undefined, to || undefined);
    if (!data) {
      return errorResponse(req, res, 500, 'RAPOR_ALINAMADI', 'Maliye rapor verisi alınamadı.');
    }
    const vergi = getVergiOzeti(data, 0);
    const html = buildMaliyeHtml(data, vergi, from, to);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    console.error('[rapor/maliye/html]', error);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'HTML rapor oluşturulamadı.');
  }
});

/**
 * Maliye raporu export: Excel (xlsx).
 * GET /api/rapor/maliye/export?format=xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/maliye/export', async (req, res) => {
  try {
    const format = (req.query.format || 'xlsx').toLowerCase();
    const from = req.query.from || '';
    const to = req.query.to || '';
    if (format !== 'xlsx') {
      return errorResponse(req, res, 400, 'INVALID_FORMAT', 'Sadece format=xlsx desteklenir. PDF için /api/rapor/maliye/html kullanıp yazdırın.');
    }
    const data = await getMaliyeRaporData(req, from || undefined, to || undefined);
    if (!data) {
      return errorResponse(req, res, 500, 'RAPOR_ALINAMADI', 'Maliye rapor verisi alınamadı.');
    }
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KBS Prime';
    const sheet = workbook.addWorksheet('Maliye Raporu', { pageSetup: { paperSize: 9, orientation: 'portrait' } });

    const fmt = data.formatDateTR || ((d) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—'));
    const fmtTime = data.formatTimeTR || ((d) => (d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'));

    sheet.columns = [
      { header: 'Tarih', key: 'tarih', width: 12 },
      { header: 'Oda No', key: 'odaNo', width: 10 },
      { header: 'Ad Soyad', key: 'adSoyad', width: 22 },
      { header: 'Giriş', key: 'giris', width: 8 },
      { header: 'Çıkış', key: 'cikis', width: 8 },
      { header: 'Ücret', key: 'ucret', width: 12 },
      { header: 'KBS No', key: 'kbsNo', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    (data.misafirler || []).forEach((m) => {
      sheet.addRow({
        tarih: fmt(m.girisTarihi),
        odaNo: m.odaNo,
        adSoyad: m.adSoyad,
        giris: fmtTime(m.girisTarihi),
        cikis: m.cikisTarihi ? fmtTime(m.cikisTarihi) : '—',
        ucret: '—',
        kbsNo: m.kbsNo,
      });
    });

    const sheet2 = workbook.addWorksheet('Özet');
    sheet2.addRow(['OTEL BİLGİLERİ']);
    sheet2.addRow(['Otel Adı', data.tesis?.ad || '—']);
    sheet2.addRow(['Vergi No', data.tesis?.vergiNo || '—']);
    sheet2.addRow(['Dolu Oda', data.doluOda ?? 0]);
    sheet2.addRow(['Toplam Oda', data.toplamOda ?? 0]);
    sheet2.addRow(['Doluluk %', (data.dolulukOrani ?? 0) + '%']);
    sheet2.addRow(['Toplam KBS Bildirim', data.toplamBildirim ?? 0]);
    sheet2.addRow(['T.C. Vatandaş', data.tcVatandas ?? 0]);
    sheet2.addRow(['Yabancı', data.yabanci ?? 0]);

    const buf = await workbook.xlsx.writeBuffer();
    const filename = `Maliye_Raporu_${(from || fmt(new Date())).replace(/\./g, '-')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buf));
  } catch (error) {
    console.error('[rapor/maliye/export]', error);
    return errorResponse(req, res, 500, 'UNHANDLED_ERROR', 'Excel rapor oluşturulamadı.');
  }
});

function buildMaliyeHtml(data, vergi, from, to) {
  const fmt = data.formatDateTR || ((d) => (d ? new Date(d).toLocaleDateString('tr-TR') : '—'));
  const fmtTime = data.formatTimeTR || ((d) => (d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'));
  const donemFrom = from || fmt(new Date());
  const donemTo = to || fmt(new Date());
  const rows = (data.misafirler || []).slice(0, 100).map((m) => `
    <tr>
      <td>${fmt(m.girisTarihi)}</td>
      <td>${m.odaNo}</td>
      <td>${m.adSoyad}</td>
      <td>${fmtTime(m.girisTarihi)}</td>
      <td>${m.cikisTarihi ? fmtTime(m.cikisTarihi) : '—'}</td>
      <td>—</td>
      <td>${m.kbsNo}</td>
    </tr>`).join('');
  const uyrukRows = (data.uyrukDagilimi || []).slice(0, 10).map((u) => `<tr><td>${u.uyruk}</td><td>${u.sayi} kişi</td></tr>`).join('');
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>KBS Prime - Maliye Raporu</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; margin: 20px; color: #222; }
    h1 { text-align: center; font-size: 16px; margin-bottom: 4px; }
    h2 { font-size: 13px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; }
    .header { text-align: center; margin-bottom: 20px; }
    .logo { font-weight: bold; color: #1a237e; }
    .signature { margin-top: 32px; }
    .meta { font-size: 11px; color: #666; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:10px;color:#333;margin-bottom:4px;">T.C. MALİYE BAKANLIĞI</div>
    <div class="logo">KBS PRIME – MALİYE RAPORU</div>
    <div style="font-size:11px;color:#666;">Otel Giriş-Çıkış ve KBS Bildirim Özeti</div>
  </div>
  <h2>OTEL BİLGİLERİ</h2>
  <table>
    <tr><td><strong>Otel Adı</strong></td><td>${data.tesis?.ad || '—'}</td></tr>
    <tr><td><strong>Vergi No</strong></td><td>${data.tesis?.vergiNo || '—'}</td></tr>
    <tr><td><strong>Adres</strong></td><td>${data.tesis?.adres || '—'}</td></tr>
    <tr><td><strong>Dönem</strong></td><td>${donemFrom} – ${donemTo}</td></tr>
  </table>
  <h2>DOLULUK RAPORU</h2>
  <table>
    <tr><td><strong>Dolu Oda</strong></td><td>${data.doluOda ?? 0}</td></tr>
    <tr><td><strong>Boş Oda</strong></td><td>${(data.toplamOda ?? 0) - (data.doluOda ?? 0)}</td></tr>
    <tr><td><strong>Toplam Oda</strong></td><td>${data.toplamOda ?? 0}</td></tr>
    <tr><td><strong>Doluluk Oranı</strong></td><td>%${data.dolulukOrani ?? 0}</td></tr>
  </table>
  <h2>MİSAFİR GİRİŞ-ÇIKIŞ LİSTESİ</h2>
  <table>
    <thead><tr><th>Tarih</th><th>Oda No</th><th>Ad Soyad</th><th>Giriş</th><th>Çıkış</th><th>Ücret</th><th>KBS No</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7">Kayıt yok</td></tr>'}</tbody>
  </table>
  <h2>KBS BİLDİRİM ÖZETİ</h2>
  <table>
    <tr><td><strong>Toplam Bildirim</strong></td><td>${data.toplamBildirim ?? 0} kişi</td></tr>
    <tr><td><strong>T.C. Vatandaş</strong></td><td>${data.tcVatandas ?? 0} kişi</td></tr>
    <tr><td><strong>Yabancı Uyruklu</strong></td><td>${data.yabanci ?? 0} kişi</td></tr>
  </table>
  ${uyrukRows ? `<h2>UYRUK DAĞILIMI</h2><table><thead><tr><th>Uyruk</th><th>Sayı</th></tr></thead><tbody>${uyrukRows}</tbody></table>` : ''}
  <h2>VERGİ RAPORU (KDV %8)</h2>
  <table>
    <tr><td><strong>Toplam Gelir</strong></td><td>${vergi.toplamGelir ?? 0} ₺</td></tr>
    <tr><td><strong>KDV Matrahı</strong></td><td>${vergi.kdvMatrah ?? 0} ₺</td></tr>
    <tr><td><strong>KDV (%8)</strong></td><td>${vergi.kdvTutar ?? 0} ₺</td></tr>
    <tr><td><strong>Toplam Tahsilat</strong></td><td>${vergi.toplamTahsilat ?? 0} ₺</td></tr>
  </table>
  <div class="signature">Yetkili İmza: __________________</div>
  <div class="meta">Rapor No: ${data.raporNo || '—'} | Düzenlenme: ${data.düzenlenmeTarihi ? fmt(new Date(data.düzenlenmeTarihi)) : '—'}</div>
</body>
</html>`;
}

module.exports = router;
