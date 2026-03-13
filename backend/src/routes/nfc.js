const express = require('express');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');

const router = express.Router();

router.use(authenticateTesisOrSupabase);

/**
 * BAC anahtarlarını al (opsiyonel: sunucu tarafında bilinen anahtarlar).
 * Mobil cihazda cache birincil; bu endpoint ek liste için kullanılabilir.
 */
router.post('/bac-keys', express.json(), async (req, res) => {
  try {
    const { countryCode, knownPatterns } = req.body || {};
    const code = (countryCode || 'TUR').toString().toUpperCase().slice(0, 3);
    const keys = [];
    if (code === 'TUR') {
      keys.push(
        { documentNo: '000000000', birthDate: '1990-01-01', expiryDate: '2030-12-31' },
        { documentNo: '111111111', birthDate: '1990-01-01', expiryDate: '2030-12-31' }
      );
    } else {
      keys.push(
        { documentNo: '000000000', birthDate: '1990-01-01', expiryDate: '2030-12-31' }
      );
    }
    res.json({ success: true, keys, count: keys.length });
  } catch (error) {
    console.error('NFC bac-keys error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Başarılı BAC anahtarını bildir (cihazda cache birincil; sunucu sadece onay döner).
 */
router.post('/bac-success', express.json(), async (req, res) => {
  try {
    const { documentNumber, birthDate, expiryDate, countryCode } = req.body || {};
    if (!documentNumber || !birthDate || !expiryDate) {
      return res.status(400).json({ success: false, message: 'documentNumber, birthDate, expiryDate gerekli' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('NFC bac-success error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * NFC okuma endpoint'i
 * Mobil uygulama NFC'den veriyi okuduktan sonra buraya gönderir
 */
router.post('/okut', async (req, res) => {
  try {
    const { nfcData } = req.body;

    if (!nfcData) {
      return res.status(400).json({ message: 'NFC verisi bulunamadı' });
    }

    // NFC verisi genellikle JSON formatında gelir
    // Gerçek uygulamada NFC okuyucu kütüphanesinden gelen ham veriyi parse etmek gerekir
    const parsed = parseNFCData(nfcData);

    res.json({
      success: true,
      parsed: parsed
    });
  } catch (error) {
    console.error('NFC okuma hatası:', error);
    res.status(500).json({ 
      message: 'NFC verisi işlenemedi', 
      error: error.message 
    });
  }
});

/**
 * NFC verisini parse et.
 * Mobil getTag() ham nesne gönderir (id, techTypes); e-passport DG1 verisi ayrı kütüphane ile okunur.
 * Ham tag geldiğinde boş/eksik alanlarla success döner ki uygulama MRZ/manuel fallback yapsın.
 */
function parseNFCData(nfcData) {
  try {
    if (typeof nfcData === 'string') {
      try {
        nfcData = JSON.parse(nfcData);
      } catch {
        return { ad: '', soyad: '', kimlikNo: null, pasaportNo: null, dogumTarihi: null, uyruk: 'TÜRK' };
      }
    }
    if (!nfcData || typeof nfcData !== 'object') {
      return { ad: '', soyad: '', kimlikNo: null, pasaportNo: null, dogumTarihi: null, uyruk: 'TÜRK' };
    }

    const ad = nfcData.givenName || nfcData.firstName || nfcData.ad || '';
    const soyad = nfcData.surname || nfcData.lastName || nfcData.soyad || '';
    const docNo = nfcData.documentNumber || nfcData.personalNumber || nfcData.documentNo || nfcData.kimlikNo || nfcData.pasaportNo || null;
    const dogumTarihi = nfcData.dateOfBirth || nfcData.dogumTarihi || null;
    const uyruk = nfcData.nationality || nfcData.uyruk || 'TÜRK';

    return {
      ad: String(ad).trim() || '',
      soyad: String(soyad).trim() || '',
      kimlikNo: docNo ? String(docNo).trim() : null,
      pasaportNo: docNo ? String(docNo).trim() : null,
      dogumTarihi: dogumTarihi ? String(dogumTarihi).trim() : null,
      uyruk: String(uyruk).trim() || 'TÜRK',
    };
  } catch (error) {
    return { ad: '', soyad: '', kimlikNo: null, pasaportNo: null, dogumTarihi: null, uyruk: 'TÜRK' };
  }
}

module.exports = router;

