const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const KIMLIK_UPLOAD_DIR = path.join(__dirname, '../../uploads/kimlikler');

// Resim kaydetme için storage yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(KIMLIK_UPLOAD_DIR)) {
      fs.mkdirSync(KIMLIK_UPLOAD_DIR, { recursive: true });
    }
    cb(null, KIMLIK_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const tesisId = req.tesis?.id || 'unknown';
    const filename = `${tesisId}_${timestamp}.jpg`;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları kabul edilir'));
    }
  }
});

router.use(authenticate);

/**
 * Kimlik/pasaport görüntüsü — sadece sahip/yonetici
 */
router.get('/kimlik/:filename', requireRole('sahip', 'yonetici'), (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!/^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)$/i.test(filename)) {
    return res.status(400).json({ message: 'Geçersiz dosya adı' });
  }
  const filePath = path.join(KIMLIK_UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Görsel bulunamadı' });
  }
  res.sendFile(filePath);
});

/**
 * MRZ (pasaport/ehliyet/kimlik) bölgesinden metin çıkar. Mobil parseMrz ile aynı ham metin kullanılır.
 * Görsel: sadece MRZ çizgileri veya belge fotoğrafı. Tesseract eng, hızlı PSM.
 */
router.post('/mrz', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Görüntü yüklenmedi' });
    }
    const { data: { text } } = await Tesseract.recognize(req.file.path, 'eng', {
      logger: () => {},
      // PSM 6 = tek blok, MRZ için daha hızlı
    });
    const raw = extractMrzFromOcr(text);
    if (!raw) {
      return res.status(400).json({ message: 'Görüntüde MRZ bulunamadı. MRZ alanını net ve çerçeve içine alın.' });
    }
    res.json({ success: true, raw });
  } catch (error) {
    console.error('OCR MRZ hatası:', error);
    res.status(500).json({ message: 'MRZ okunamadı', error: error.message });
  }
});

/** OCR çıktısından MRZ benzeri satırları bul (sadece A-Z, 0-9, < ; uzunluk 30, 36 veya 44) */
function extractMrzFromOcr(text) {
  if (!text || typeof text !== 'string') return '';
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().toUpperCase().replace(/\s/g, ''));
  const mrzLike = lines.filter((l) => /^[A-Z0-9<]+$/.test(l) && (l.length === 30 || l.length === 36 || l.length === 44));
  if (mrzLike.length >= 2) return mrzLike.join('\n');
  if (mrzLike.length === 1 && mrzLike[0].length >= 30) return mrzLike[0];
  return '';
}

/**
 * OCR ile kimlik/pasaport okuma
 */
router.post('/okut', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Görüntü yüklenmedi' });
    }

    const languages = req.query.languages || 'tur+eng';
    const { data: { text } } = await Tesseract.recognize(
      req.file.path,
      languages,
      { logger: () => {} }
    );

    const parsed = parseIdentityDocument(text);

    // Resim URL'si oluştur (backend'den erişilebilir)
    const imageUrl = `/api/ocr/kimlik/${req.file.filename}`;

    res.json({
      success: true,
      rawText: text,
      parsed: parsed,
      imageUrl,
      imagePath: req.file.path
    });
  } catch (error) {
    console.error('OCR hatası:', error);
    res.status(500).json({ 
      message: 'OCR işlemi başarısız', 
      error: error.message 
    });
  }
});

/** TC Kimlik no algoritma kontrolü (10. ve 11. hane) */
function validateTC(tc) {
  if (!tc || !/^\d{11}$/.test(tc)) return false;
  const d = tc.split('').map(Number);
  if (d[0] === 0) return false;
  const k10 = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  const k10digit = ((k10 % 10) + 10) % 10;
  if (k10digit !== d[9]) return false;
  const sum10 = d[0] + d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7] + d[8] + d[9];
  const k11digit = sum10 % 10;
  return k11digit === d[10];
}

/** Rakamları temizle (OCR hataları: O/0, I/1) */
function normalizeDigits(str) {
  return str.replace(/[O]/g, '0').replace(/[lI]/g, '1').replace(/\D/g, '');
}

function parseIdentityDocument(text) {
  const raw = text.replace(/\r\n/g, '\n');
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const result = {
    ad: '',
    soyad: '',
    kimlikNo: null,
    pasaportNo: null,
    dogumTarihi: null,
    uyruk: 'TÜRK'
  };

  const kimlikCandidates = [];
  const pasaportCandidates = [];
  const tarihCandidates = [];

  for (const line of lines) {
    const onlyDigits = line.replace(/\D/g, '');
    const normalized = normalizeDigits(line);

    const tc11 = line.match(/\b\d{11}\b/g) || normalized.match(/\d{11}/g);
    if (tc11) {
      for (const cand of tc11) {
        const cleaned = cand.replace(/[O]/g, '0').replace(/[lI]/g, '1');
        if (/^\d{11}$/.test(cleaned) && validateTC(cleaned)) {
          result.kimlikNo = cleaned;
          break;
        }
        kimlikCandidates.push(cleaned);
      }
    }

    if (!result.kimlikNo && /[A-Z]{1,2}\d{6,9}/.test(line)) {
      const m = line.match(/\b([A-Z]{1,2}\d{6,9})\b/g);
      if (m) pasaportCandidates.push(...m);
    }

    const tarihDDMMYYYY = line.match(/\b(\d{2})[./\-](\d{2})[./\-](\d{4})\b/g);
    if (tarihDDMMYYYY) {
      for (const t of tarihDDMMYYYY) {
        const normalizedTarih = t.replace(/\//g, '.').replace(/-/g, '.');
        const [, , , y] = normalizedTarih.match(/(\d{2})[.](\d{2})[.](\d{4})/) || [];
        if (y) {
          const year = parseInt(y, 10);
          if (year >= 1920 && year <= 2015) tarihCandidates.push(normalizedTarih);
        }
      }
    }
  }

  if (!result.kimlikNo && kimlikCandidates.length > 0) {
    const valid = kimlikCandidates.find(c => /^\d{11}$/.test(c) && validateTC(c));
    if (valid) result.kimlikNo = valid;
    else result.kimlikNo = kimlikCandidates[0].replace(/\D/g, '').slice(0, 11);
  }
  if (!result.kimlikNo && pasaportCandidates.length > 0) {
    result.pasaportNo = pasaportCandidates[0];
  }
  if (tarihCandidates.length > 0) {
    result.dogumTarihi = tarihCandidates[0];
  }

  const uyrukRegex = /\b(?:TÜRK|TURK|TUR|T\.C\.|TURKEY|TURKIYE)\b/i;
  for (const line of lines) {
    if (uyrukRegex.test(line)) {
      result.uyruk = 'TÜRK';
      break;
    }
  }

  const nameLike = /^[A-Za-zÇĞİÖŞÜçğıöşü\s\-]+$/;
  for (const line of lines) {
    if (line.length > 4 && nameLike.test(line) && !/\d{2,}/.test(line)) {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        result.ad = parts[0].trim();
        result.soyad = parts.slice(1).join(' ').trim();
        break;
      }
    }
  }

  return result;
}

module.exports = router;

