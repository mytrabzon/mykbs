const express = require('express');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

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
 * NFC verisini parse et
 * Gerçek uygulamada NFC okuyucu kütüphanesinin formatına göre düzenlenmeli
 */
function parseNFCData(nfcData) {
  // Örnek: NFC'den gelen veri yapısı
  // Gerçek uygulamada passport.js veya benzeri kütüphane kullanılabilir
  try {
    if (typeof nfcData === 'string') {
      nfcData = JSON.parse(nfcData);
    }

    return {
      ad: nfcData.givenName || nfcData.firstName || '',
      soyad: nfcData.surname || nfcData.lastName || '',
      kimlikNo: nfcData.documentNumber || nfcData.personalNumber || null,
      pasaportNo: nfcData.documentNumber || null,
      dogumTarihi: nfcData.dateOfBirth || null,
      uyruk: nfcData.nationality || 'TÜRK'
    };
  } catch (error) {
    throw new Error('NFC verisi parse edilemedi');
  }
}

module.exports = router;

