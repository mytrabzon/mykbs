const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');

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
    const tesisId = req.tesis?.id || req.branchId || req.user?.id || 'unknown';
    const filename = `${String(tesisId).slice(0, 20)}_${timestamp}.jpg`;
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

/** MRZ satırını standart uzunluğa tamamla (< ile). */
function padMrzLine(line, targetLen) {
  if (!line || targetLen < 1) return line;
  return line.padEnd(targetLen, '<').slice(0, targetLen);
}

/** OCR çıktısından MRZ benzeri satırları bul (TD1: 3x30 kimlik, TD2: 2x36, TD3: 2x44 pasaport). Esnek uzunluk kabul. */
function extractMrzFromOcr(text) {
  if (!text || typeof text !== 'string') return '';
  const one = text.replace(/\s/g, '').trim().toUpperCase();
  if (/^[A-Z0-9<]+$/.test(one) && one.length >= 88 && one.length <= 92) {
    if (one.length >= 89 && one.length <= 91) {
      const s1 = padMrzLine(one.slice(0, 30), 30);
      const s2 = padMrzLine(one.slice(30, 60), 30);
      const s3 = padMrzLine(one.slice(60, 90), 30);
      return s1 + '\n' + s2 + '\n' + s3;
    }
    const s1 = padMrzLine(one.slice(0, 44), 44);
    const s2 = padMrzLine(one.slice(44, 88), 44);
    return s1 + '\n' + s2;
  }
  if (/^[A-Z0-9<]+$/.test(one) && one.length >= 70 && one.length <= 74) {
    const s1 = padMrzLine(one.slice(0, 36), 36);
    const s2 = padMrzLine(one.slice(36, 72), 36);
    return s1 + '\n' + s2;
  }
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().toUpperCase().replace(/\s/g, ''));
  const mrzLike = lines.filter((l) => /^[A-Z0-9<]+$/.test(l) && l.length >= 26 && l.length <= 46);
  if (mrzLike.length >= 3 && mrzLike.every((l) => l.length >= 28 && l.length <= 32)) {
    return mrzLike.slice(0, 3).map((l) => padMrzLine(l, 30)).join('\n');
  }
  if (mrzLike.length >= 2 && mrzLike.every((l) => l.length >= 34 && l.length <= 38)) {
    return mrzLike.slice(0, 2).map((l) => padMrzLine(l, 36)).join('\n');
  }
  if (mrzLike.length >= 2 && mrzLike.every((l) => l.length >= 40 && l.length <= 46)) {
    return mrzLike.slice(0, 2).map((l) => padMrzLine(l, 44)).join('\n');
  }
  if (mrzLike.length >= 2) {
    const l0 = mrzLike[0].length, l1 = mrzLike[1].length;
    if (l0 >= 40 && l1 >= 40) return padMrzLine(mrzLike[0], 44) + '\n' + padMrzLine(mrzLike[1], 44);
    if (l0 >= 34 && l1 >= 34) return padMrzLine(mrzLike[0], 36) + '\n' + padMrzLine(mrzLike[1], 36);
    if (l0 >= 28 && l1 >= 28) return padMrzLine(mrzLike[0], 30) + '\n' + padMrzLine(mrzLike[1], 30);
  }
  if (mrzLike.length === 1 && mrzLike[0].length >= 30) return mrzLike[0];
  return '';
}

/** Fotokopi/kağıt MRZ için güçlü ön işleme: yüksek kontrast – basılı MRZ anında okunur */
async function preprocessImageForMrz(filePath) {
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    await image
      .greyscale()
      .normalize()
      .contrast(0.45)
      .write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/** MRZ: Fotokopi/kağıt için güçlü ön işleme + Tesseract. Kağıt üzerinde basılı MRZ da pasaport gibi okunur. */
router.post('/mrz', authenticateTesisOrSupabase, upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file || !filePath) {
      return res.status(400).json({ message: 'Görüntü yüklenmedi' });
    }
    const processedPath = await preprocessImageForMrz(filePath);
    const { data: { text } } = await Tesseract.recognize(processedPath, 'eng+tur', { logger: () => {} });
    const raw = extractMrzFromOcr(text);
    if (!raw) {
      return res.status(400).json({ message: 'Görüntüde MRZ bulunamadı. MRZ alanını net ve çerçeve içine alın.' });
    }
    res.json({ success: true, raw });
  } catch (error) {
    console.error('OCR MRZ hatası:', error);
    res.status(500).json({ message: 'MRZ okunamadı', error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
});

/** Tek görsel: MRZ + ön yüz OCR. Fotokopi/kağıt MRZ + Arapça/İngilizce isim için eng+ara+tur. */
function runOcrOnFile(filePath) {
  const languages = 'eng+ara+tur';
  return preprocessImageForMrz(filePath).then((processedPath) =>
    Tesseract.recognize(processedPath, languages, { logger: () => {} }).then(({ data: { text } }) => {
      const mrzRaw = extractMrzFromOcr(text);
      const parsed = parseIdentityDocument(text);
      const mrzPayload = mrzRaw ? parseMrzToPayload(mrzRaw) : null;
      const merged = mergeMrzAndFront(mrzPayload, parsed);
      return { rawText: text, mrzRaw, mrzPayload, front: parsed, merged };
    })
  );
}

router.post('/document', authenticateTesisOrSupabase, upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file || !filePath) {
      return res.status(400).json({ message: 'Görüntü yüklenmedi' });
    }
    const { rawText, mrzRaw, mrzPayload, front, merged } = await runOcrOnFile(filePath);
    res.json({
      success: true,
      rawText: rawText,
      mrz: mrzRaw || null,
      mrzPayload: mrzPayload || null,
      front,
      merged,
    });
  } catch (error) {
    console.error('OCR document hatası:', error);
    res.status(500).json({ message: 'Belge okunamadı', error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
});

/** Galeriden seçilen görsel: base64 ile gönder (Android content URI FormData sorununu aşar). */
router.post('/document-base64', authenticateTesisOrSupabase, express.json({ limit: '8mb' }), async (req, res) => {
  const base64 = req.body?.imageBase64;
  let filePath = null;
  try {
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ message: 'imageBase64 gerekli' });
    }
    const buf = Buffer.from(base64, 'base64');
    if (buf.length === 0) {
      return res.status(400).json({ message: 'Geçersiz görüntü' });
    }
    if (!fs.existsSync(KIMLIK_UPLOAD_DIR)) {
      fs.mkdirSync(KIMLIK_UPLOAD_DIR, { recursive: true });
    }
    filePath = path.join(KIMLIK_UPLOAD_DIR, `base64_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`);
    fs.writeFileSync(filePath, buf);
    const { rawText, mrzRaw, mrzPayload, front, merged } = await runOcrOnFile(filePath);
    res.json({
      success: true,
      rawText,
      mrz: mrzRaw || null,
      mrzPayload: mrzPayload || null,
      front,
      merged,
    });
  } catch (error) {
    console.error('OCR document-base64 hatası:', error);
    res.status(500).json({ message: 'Belge okunamadı', error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }
});

/** Toplu belge: en fazla 10 görsel (5–10’lu seçim) */
const uploadMany = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(KIMLIK_UPLOAD_DIR)) fs.mkdirSync(KIMLIK_UPLOAD_DIR, { recursive: true });
      cb(null, KIMLIK_UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      cb(null, `${String(Date.now())}_${Math.random().toString(36).slice(2, 8)}.jpg`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Sadece resim'))),
}).array('images', 10);

/** Toplu belge: Tüm giriş yapmış kullanıcılar kullanabilir (admin şart değil). */
router.post('/documents-batch', authenticateTesisOrSupabase, (req, res) => {
  uploadMany(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Yükleme hatası' });
    }
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'En az 1, en fazla 10 görsel gönderin.' });
    }
    const results = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = file?.path;
      try {
        const { data: { text } } = await Tesseract.recognize(filePath, 'tur+eng', { logger: () => {} });
        const mrzRaw = extractMrzFromOcr(text);
        const parsed = parseIdentityDocument(text);
        const mrzPayload = mrzRaw ? parseMrzToPayload(mrzRaw) : null;
        const merged = mergeMrzAndFront(mrzPayload, parsed);
        results.push({ index: i, success: true, mrz: mrzRaw, front: parsed, merged });
      } catch (e) {
        results.push({ index: i, success: false, error: e.message });
      } finally {
        if (filePath && fs.existsSync(filePath)) fs.unlink(filePath, () => {});
      }
    }
    res.json({ success: true, results });
  });
});

router.use(authenticateTesisOrSupabase);

/**
 * Kimlik/pasaport görüntüsü — tüm giriş yapmış kullanıcılar (admin şart değil; Supabase veya legacy token yeterli)
 */
router.get('/kimlik/:filename', (req, res) => {
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
    nameAr: '',
    adAr: '',
    soyadAr: '',
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

  const nameLike = /^[A-Za-zÇĞİÖŞÜçğıöşü\s\-']+$/;
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

  const arabicRegex = /[\u0600-\u06FF]/;
  const arabicLines = lines.filter((l) => l.length > 2 && arabicRegex.test(l));
  if (arabicLines.length > 0) {
    result.nameAr = arabicLines.join(' ').trim();
    const parts = arabicLines[0].trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      result.adAr = parts[0];
      result.soyadAr = parts.slice(1).join(' ');
    } else if (arabicLines.length >= 2) {
      result.adAr = arabicLines[0].trim();
      result.soyadAr = arabicLines.slice(1).join(' ').trim();
    } else {
      result.adAr = result.nameAr;
    }
  }

  return result;
}

/** MRZ ham string → belge no, tarihler, isim, ülke (TD1/TD2/TD3) */
function normalizeMrzLinesBackend(raw) {
  const one = (raw || '').trim().toUpperCase().replace(/\s/g, '');
  if (one.length === 90 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 30), one.slice(30, 60), one.slice(60, 90)];
  }
  if (one.length === 88 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 44), one.slice(44, 88)];
  }
  if (one.length === 72 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 36), one.slice(36, 72)];
  }
  return (raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.trim().toUpperCase().replace(/\s/g, '')).filter(Boolean);
}

function normalizeYYMMDD(yymmdd) {
  if (!yymmdd || yymmdd.length < 6) return '';
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  return year + '-' + mm + '-' + dd;
}

function parseMrzToPayload(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lines = normalizeMrzLinesBackend(raw);
  let docNumber = '';
  let birthDate = '';
  let expiryDate = '';
  let surname = '';
  let givenNames = '';
  let issuingCountry = '';
  if (lines.length >= 2 && lines[0].length >= 40) {
    const l2 = (lines[1] || '').padEnd(44, '<');
    docNumber = l2.substring(0, 9).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(13, 19));
    expiryDate = normalizeYYMMDD(l2.substring(21, 27));
    issuingCountry = (lines[0] || '').substring(2, 5).replace(/</g, '').trim();
    const nameBlock = (lines[0] || '').substring(5, 44);
    const parts = nameBlock.split('<<').filter(Boolean);
    surname = (parts[0] || '').replace(/</g, ' ').trim();
    givenNames = (parts[1] || '').replace(/</g, ' ').trim();
  } else if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) {
    const l2 = (lines[1] || '').padEnd(36, '<');
    docNumber = l2.substring(0, 9).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(13, 19));
    expiryDate = normalizeYYMMDD(l2.substring(21, 27));
    issuingCountry = (lines[0] || '').substring(2, 5).replace(/</g, '').trim();
    const nameBlock = (lines[0] || '').substring(5, 36);
    const parts = nameBlock.split('<<').filter(Boolean);
    surname = (parts[0] || '').replace(/</g, ' ').trim();
    givenNames = (parts[1] || '').replace(/</g, ' ').trim();
  } else if (lines.length >= 3 && lines[0].length >= 28) {
    const l1 = (lines[0] || '').padEnd(30, '<');
    const l2 = (lines[1] || '').padEnd(30, '<');
    const l3 = (lines[2] || '').padEnd(30, '<');
    docNumber = l1.substring(5, 14).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(0, 6));
    expiryDate = normalizeYYMMDD(l2.substring(8, 14));
    issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
    const nameBlock = l3.replace(/</g, ' ').trim();
    const nameParts = nameBlock.split(/\s{2,}/).filter(Boolean);
    surname = (nameParts[0] || '').trim();
    givenNames = (nameParts.slice(1).join(' ') || '').trim();
  } else {
    return null;
  }
  return { documentNumber: docNumber, birthDate, expiryDate, surname, givenNames, issuingCountry };
}

/** MRZ + ön yüz OCR → tek merged obje (MRZ öncelikli). Arapça/İngilizce isimler parsed'dan. */
function mergeMrzAndFront(mrzPayload, parsed) {
  const merged = {
    ad: parsed?.ad || '',
    soyad: parsed?.soyad || '',
    nameAr: parsed?.nameAr || '',
    adAr: parsed?.adAr || '',
    soyadAr: parsed?.soyadAr || '',
    kimlikNo: parsed?.kimlikNo || null,
    pasaportNo: parsed?.pasaportNo || null,
    dogumTarihi: parsed?.dogumTarihi || null,
    uyruk: parsed?.uyruk || 'TÜRK',
    belgeNo: '',
    sonKullanma: null,
    ulkeKodu: '',
  };
  if (mrzPayload) {
    merged.belgeNo = mrzPayload.documentNumber || merged.belgeNo;
    merged.dogumTarihi = mrzPayload.birthDate || merged.dogumTarihi;
    merged.sonKullanma = mrzPayload.expiryDate || merged.sonKullanma;
    merged.ulkeKodu = mrzPayload.issuingCountry || merged.ulkeKodu;
    if (mrzPayload.surname || mrzPayload.givenNames) {
      merged.soyad = mrzPayload.surname || merged.soyad;
      merged.ad = mrzPayload.givenNames || merged.ad;
    }
  }
  if (parsed?.kimlikNo) merged.kimlikNo = parsed.kimlikNo;
  if (parsed?.pasaportNo && !merged.belgeNo) merged.pasaportNo = parsed.pasaportNo;
  if (parsed?.dogumTarihi && !merged.dogumTarihi) merged.dogumTarihi = parsed.dogumTarihi;
  if (parsed?.nameAr) merged.nameAr = parsed.nameAr;
  if (parsed?.adAr) merged.adAr = parsed.adAr;
  if (parsed?.soyadAr) merged.soyadAr = parsed.soyadAr;
  return merged;
}

module.exports = router;

