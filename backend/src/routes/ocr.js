const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const {
  cropBottomFraction,
  cropTopFraction,
  cropCenterFraction,
  preprocessForKimlikMrz,
  preprocessForPaperMrz,
  preprocessForPhotocopyMrz,
  cropMrzCandidates,
  rotateImage,
} = require('../lib/vision/preprocess');
const { parseMrzRaw } = require('../lib/vision/mrz');

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

const DEBUG_MRZ = process.env.DEBUG_MRZ !== '0' && process.env.DEBUG_MRZ !== 'false';

const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const TESS_MRZ_OPTS = { logger: () => {}, tessedit_char_whitelist: MRZ_WHITELIST };

/** MRZ adayı için puan: checksum +100, satır uzunluğu +20, < oranı +10, whitelist +10, fix az +5. */
function scoreMrzCandidate(raw, fixedRaw, parsed) {
  if (!raw || !parsed) return 0;
  let score = 0;
  if (parsed.checks && parsed.checks.compositeCheck) score += 100;
  const lines = (fixedRaw || raw).replace(/\r/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
  const stdLens = [30, 44, 36];
  const allCorrectLen = lines.every((l) => stdLens.some((len) => l.length === len));
  if (allCorrectLen) score += 20;
  const one = (fixedRaw || raw).replace(/\s/g, '');
  const angleRatio = (one.match(/</g) || []).length / Math.max(1, one.length);
  if (angleRatio >= 0.02 && angleRatio <= 0.3) score += 10;
  if (/^[A-Z0-9<\s\n\r]+$/i.test(raw)) score += 10;
  if (fixedRaw && raw !== fixedRaw) {
    const changeCount = (fixedRaw.length - raw.length) + (fixedRaw.split('').filter((c, i) => raw[i] !== c).length);
    if (changeCount <= 3) score += 5;
  }
  return score;
}

/** MRZ satırını standart uzunluğa tamamla (< ile). */
function padMrzLine(line, targetLen) {
  if (!line || targetLen < 1) return line;
  return line.padEnd(targetLen, '<').slice(0, targetLen);
}

/** OCR çıktısını MRZ parse için normalize et: uppercase, boşluk sil, «‹→<, sadece A-Z0-9< bırak. */
function normalizeOcrTextForMrz(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/[\u00AB\u2039\u203A\u00BB]/g, '<')
    .replace(/\s/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9<]/g, '');
}

/** OCR çıktısından MRZ satır adayları: kimlik/pasaport/fotokopi 22+ karakter. TD3 (pasaport) 2x44 için 38-46 da kabul. */
function extractMrzLinesFromOcr(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split(/\r\n|\r|\n/)
    .map((l) => l.trim().toUpperCase().replace(/\s/g, '').replace(/[\u00AB\u2039]/g, '<'))
    .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 22);
  const withAngle = lines.filter((l) => l.includes('<'));
  const twoLine44 = lines.filter((l) => l.length >= 38 && l.length <= 46);
  const threeLine30 = lines.filter((l) => l.length >= 24 && l.length <= 33);
  const candidates = threeLine30.length >= 3 ? threeLine30.slice(0, 3)
    : (withAngle.length >= 2 ? withAngle : (twoLine44.length >= 2 ? twoLine44 : lines));
  return candidates.filter((l) => l.length >= 22 && l.length <= 46);
}

/** OCR çıktısından MRZ benzeri satırları bul (TD1: 3x30 kimlik, TD2: 2x36, TD3: 2x44 pasaport). Esnek uzunluk kabul. */
function extractMrzFromOcr(text) {
  if (!text || typeof text !== 'string') return '';
  const normalized = normalizeOcrTextForMrz(text);
  const one = normalized.trim();
  if (one.length >= 82 && one.length <= 95 && /^[A-Z0-9<]+$/.test(one)) {
    const n = one.length;
    if (n >= 85 && n <= 95) {
      const a = n >= 90 ? 30 : Math.floor(n / 3);
      const s1 = padMrzLine(one.slice(0, a), 30);
      const s2 = padMrzLine(one.slice(a, a * 2), 30);
      const s3 = padMrzLine(one.slice(a * 2, n), 30);
      return s1 + '\n' + s2 + '\n' + s3;
    }
    if (n >= 82 && n <= 84) {
      const a = 42;
      const s1 = padMrzLine(one.slice(0, a), 44);
      const s2 = padMrzLine(one.slice(a, n), 44);
      return s1 + '\n' + s2;
    }
  }
  if (one.length >= 80 && one.length <= 96 && /^[A-Z0-9<]+$/.test(one)) {
    const a = 44;
    const s1 = padMrzLine(one.slice(0, a), 44);
    const s2 = padMrzLine(one.slice(a, one.length), 44);
    return s1 + '\n' + s2;
  }
  if (one.length >= 68 && one.length <= 76 && /^[A-Z0-9<]+$/.test(one)) {
    const s1 = padMrzLine(one.slice(0, 36), 36);
    const s2 = padMrzLine(one.slice(36, 72), 36);
    return s1 + '\n' + s2;
  }
  const lines = extractMrzLinesFromOcr(text);
  if (lines.length >= 3 && lines.every((l) => l.length >= 24 && l.length <= 33)) {
    return lines.slice(0, 3).map((l) => padMrzLine(l, 30)).join('\n');
  }
  if (lines.length >= 3 && lines.some((l) => l.length >= 26 && l.length <= 32)) {
    const take = lines.filter((l) => l.length >= 26 && l.length <= 32).slice(0, 3);
    if (take.length >= 3) return take.map((l) => padMrzLine(l, 30)).join('\n');
  }
  if (lines.length >= 2 && lines.every((l) => l.length >= 36 && l.length <= 46)) {
    return lines.slice(0, 2).map((l) => padMrzLine(l, 44)).join('\n');
  }
  if (lines.length >= 2 && lines.every((l) => l.length >= 30 && l.length <= 38)) {
    return lines.slice(0, 2).map((l) => padMrzLine(l, 36)).join('\n');
  }
  if (lines.length >= 2) {
    const l0 = lines[0].length, l1 = lines[1].length;
    if (l0 >= 36 && l1 >= 36) return padMrzLine(lines[0], 44) + '\n' + padMrzLine(lines[1], 44);
    if (l0 >= 30 && l1 >= 30) return padMrzLine(lines[0], 36) + '\n' + padMrzLine(lines[1], 36);
    if (l0 >= 22 && l1 >= 22) return padMrzLine(lines[0], 30) + '\n' + padMrzLine(lines[1], 30);
  }
  if (lines.length >= 3) return lines.slice(0, 3).map((l) => padMrzLine(l, 30)).join('\n');
  if (lines.length === 1 && lines[0].length >= 22) return padMrzLine(lines[0], 30);
  return '';
}

/** Fotokopide OCR O→0, I/L→1 hatalarını rakam alanlarında düzeltir (parse öncesi). */
function fixMrzOcrErrorsBackend(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const lines = normalizeMrzLinesBackend(raw);
  if (lines.length >= 2 && lines[0].length >= 38) {
    lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
  } else if (lines.length >= 2 && lines[0].length >= 32 && lines[0].length <= 36) {
    lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
  } else if (lines.length >= 3 && lines[0].length >= 22) {
    lines[0] = fixLineDigitPositions(lines[0], [[5, 15]]);
    lines[1] = fixLineDigitPositions(lines[1], [[0, 8], [8, 15]]);
  }
  return lines.join('\n');
}
function fixLineDigitPositions(line, digitRanges) {
  if (!line) return line;
  const arr = line.split('');
  for (const [start, end] of digitRanges) {
    for (let i = start; i < end && i < arr.length; i++) {
      const c = arr[i];
      if (c === 'O' || c === 'Q') arr[i] = '0';
      else if (c === 'I' || c === 'L' || c === '|') arr[i] = '1';
      else if (c === 'S' && i >= 13 && i < 20) arr[i] = '5';
    }
  }
  return arr.join('');
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

/**
 * Bölge: full | bottom | top | center + fraction. MRZ nerede olursa olsun taranır.
 */
async function tryMrzFromImageWithRegion(imagePath, region, preprocessFn) {
  let pathToOcr = imagePath;
  let cropPath = null;
  const dir = path.dirname(imagePath);
  const ts = Date.now();
  if (region.type === 'full') {
    await preprocessFn(imagePath);
    pathToOcr = imagePath;
  } else {
    const frac = region.fraction ?? 0.4;
    cropPath = path.join(dir, `mrz_crop_${ts}_${region.type}_${frac}.jpg`);
    if (region.type === 'bottom') await cropBottomFraction(imagePath, frac, cropPath);
    else if (region.type === 'top') await cropTopFraction(imagePath, frac, cropPath);
    else if (region.type === 'center') await cropCenterFraction(imagePath, frac, cropPath);
    else await cropBottomFraction(imagePath, frac, cropPath);
    await preprocessFn(cropPath);
    pathToOcr = cropPath;
  }
  const tesseractOpts = { logger: () => {}, tessedit_pageseg_mode: 6 };
  let text = (await Tesseract.recognize(pathToOcr, 'eng', tesseractOpts)).data.text;
  let raw = extractMrzFromOcr(text);
  if (!raw && text) {
    const resTur = await Tesseract.recognize(pathToOcr, 'eng+tur', tesseractOpts);
    text = resTur.data.text;
    raw = extractMrzFromOcr(text);
  }
  if (cropPath && fs.existsSync(cropPath)) fs.unlink(cropPath, () => {});
  let payload = null;
  if (raw) {
    const fixed = fixMrzOcrErrorsBackend(raw);
    payload = parseMrzToPayload(fixed) || parseMrzToPayload(raw);
  }
  if (DEBUG_MRZ && text) {
    const lines = extractMrzLinesFromOcr(text);
    console.log('[MRZ] region=', region.type, region.fraction ?? '—', 'lines=', lines.length, 'rawLen=', raw?.length || 0, 'payload=', payload ? 'ok' : 'fail');
  }
  return { raw, payload };
}

/**
 * Tek bir görüntü path'inde OCR çalıştırır; PSM ve whitelist kullanır.
 * @param {object} worker - Tesseract worker (createWorker ile oluşturulmuş)
 * @param {string} imagePath - Ön işlenmiş görüntü path
 * @param {number} psm - tessedit_pageseg_mode (7, 6, 11, 13)
 */
async function runOcrWithPsm(worker, imagePath, psm) {
  const opts = { ...TESS_MRZ_OPTS, tessedit_pageseg_mode: psm };
  const { data } = await worker.recognize(imagePath, opts);
  return data.text;
}

/**
 * Kimlik MRZ canavarı: multi-preprocess × multi-PSM × crop candidates × rotate/deskew, checksum bazlı skor.
 * @param {string} filePath - Yüklenen görüntü path
 * @returns {Promise<{ ok: boolean, mrzRaw?: string, payload?: object, score?: number, attemptsUsed?: number, qualityHints?: object }>}
 */
async function runMrzPipeline(filePath) {
  const dir = path.join(os.tmpdir(), `mrz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  const tempPaths = new Set();
  const registerTemp = (p) => { if (p && fs.existsSync(p)) tempPaths.add(p); };
  const cleanup = () => {
    tempPaths.forEach((p) => { try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {} });
    try { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true }); } catch (_) {}
  };

  let best = { score: 0, raw: '', fixed: '', payload: null, attemptsUsed: 0 };
  const qualityHints = { needMoreZoom: false, glareHigh: false, blurry: false, suggestTorch: 'keep' };

  try {
    const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });

    const preprocessVariants = [
      { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.55 }), name: 'kimlik' },
      { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.65 }), name: 'kimlikMid' },
      { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.8 }), name: 'kimlikHi' },
      { fn: (p) => preprocessForKimlikMrz(p, { sharpen: true }), name: 'kimlikSharp' },
      { fn: preprocessForPhotocopyMrz, name: 'photocopy' },
      { fn: preprocessForPaperMrz, name: 'paper' },
    ];

    const psms = [7, 13, 6, 11];
    const bottomFractions = [0.35, 0.30, 0.28, 0.25, 0.22, 0.20, 0.18, 0.15, 0.12, 0.40];

    async function tryImage(inputPath) {
      for (const variant of preprocessVariants) {
        const prePath = path.join(dir, `pre_${variant.name}_${Date.now()}.jpg`);
        try {
          const Jimp = (await import('jimp')).default;
          const img = await Jimp.read(inputPath);
          await img.write(prePath);
          registerTemp(prePath);
        } catch (_) { continue; }
        await variant.fn(prePath);
        for (const psm of psms) {
          best.attemptsUsed++;
          let text = '';
          try {
            text = await runOcrWithPsm(worker, prePath, psm);
          } catch (_) { continue; }
          let raw = extractMrzFromOcr(text);
          if (!raw) continue;
          let fixed = raw;
          let parsed = parseMrzRaw(raw);
          if (!parsed) {
            fixed = fixMrzOcrErrorsBackend(raw);
            parsed = parseMrzRaw(fixed);
          } else if (parsed.checks && !parsed.checks.compositeCheck) {
            fixed = fixMrzOcrErrorsBackend(raw);
            const reparsed = parseMrzRaw(fixed);
            if (reparsed) parsed = reparsed;
          }
          if (!parsed) continue;
          const score = scoreMrzCandidate(raw, fixed, parsed);
          if (score > best.score) {
            best.score = score;
            best.raw = raw;
            best.fixed = fixed;
            best.payload = mrzFieldsToPayload(parsed.fields);
          }
          if (best.score >= 100) return true;
        }
      }
      return false;
    }

    for (const frac of bottomFractions) {
      const cropPath = path.join(dir, `crop_bottom_${frac}.jpg`);
      await cropBottomFraction(filePath, frac, cropPath);
      registerTemp(cropPath);
      if (await tryImage(cropPath)) break;
    }

    if (best.score < 100) {
      const candidates = await cropMrzCandidates(filePath, dir);
      for (const { path: cropPath } of candidates) {
        registerTemp(cropPath);
        if (await tryImage(cropPath)) break;
      }
    }

    if (best.score < 50) {
      const angles = [90, 180, 270];
      for (const deg of angles) {
        const rotatedPath = path.join(dir, `rot_${deg}.jpg`);
        await rotateImage(filePath, deg, rotatedPath);
        registerTemp(rotatedPath);
        for (const frac of [0.4, 0.3]) {
          const cropPath = path.join(dir, `rot${deg}_crop_${frac}.jpg`);
          await cropBottomFraction(rotatedPath, frac, cropPath);
          registerTemp(cropPath);
          if (await tryImage(cropPath)) break;
        }
        if (best.score >= 100) break;
      }
    }

    await worker.terminate();
  } catch (e) {
    if (DEBUG_MRZ) console.error('[MRZ] pipeline error', e.message);
  } finally {
    cleanup();
  }

  const ok = !!(best.raw && (best.payload || best.score >= 50));
  return {
    ok,
    mrzRaw: best.raw || undefined,
    payload: best.payload || undefined,
    score: best.score,
    attemptsUsed: best.attemptsUsed,
    qualityHints,
  };
}

/** MRZ bulunamadığında kullanıcıya gösterilecek sebep metni (pasaport/kimlik fark etmez). */
function buildMrzFailureReason(mrzResult, fallbackAlsoFailed) {
  const attempts = (mrzResult && mrzResult.attemptsUsed) || 0;
  const score = (mrzResult && mrzResult.score) || 0;
  const parts = [];
  if (attempts > 0) {
    parts.push(`${attempts} farklı okuma denemesi yapıldı, MRZ satırı tespit edilemedi.`);
  }
  if (score > 0 && score < 50) {
    parts.push('Okunan metin MRZ formatına uymuyor (kimlik/pasaport arka yüzündeki 2 veya 3 satırlık bant).');
  }
  parts.push('Lütfen: (1) Belgenin arka yüzündeki MRZ bandı tam ve net görünsün, (2) Işık yeterli olsun veya fener kullanın, (3) Görüntü bulanık veya kesik olmasın.');
  return parts.join(' ');
}

/** mrz.js parsed.fields → ocr payload format (documentNumber, birthDate, ...). */
function mrzFieldsToPayload(fields) {
  if (!fields) return null;
  return {
    documentNumber: fields.documentNumber || '',
    birthDate: fields.birthDate || '',
    expiryDate: fields.expiryDate || '',
    surname: fields.surname || '',
    givenNames: fields.givenNames || '',
    issuingCountry: fields.issuingCountry || '',
  };
}

/** MRZ: runMrzPipeline ile multi-preprocess/PSM/score; cevap ok, mrzRaw, payload, score, attemptsUsed, qualityHints. */
router.post('/mrz', authenticateTesisOrSupabase, upload.single('image'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file || !filePath) {
      return res.status(400).json({ message: 'Görüntü yüklenmedi' });
    }
    const result = await runMrzPipeline(filePath);
    if (result.mrzRaw) {
      return res.json({
        success: true,
        raw: result.mrzRaw,
        ok: result.ok,
        payload: result.payload,
        score: result.score,
        attemptsUsed: result.attemptsUsed,
        qualityHints: result.qualityHints,
      });
    }
    const preprocess = preprocessForPaperMrz;
    const regions = [
      { type: 'full' },
      { type: 'bottom', fraction: 0.5 },
      { type: 'bottom', fraction: 0.35 },
      { type: 'bottom', fraction: 0.25 },
    ];
    let fallbackRaw = '';
    let fallbackPayload = null;
    for (const region of regions) {
      const r = await tryMrzFromImageWithRegion(filePath, region, preprocess);
      if (r.payload) { fallbackRaw = r.raw; fallbackPayload = r.payload; break; }
      if (r.raw) fallbackRaw = r.raw;
    }
    if (fallbackRaw) {
      return res.json({
        success: true,
        raw: fallbackRaw,
        ok: !!fallbackPayload,
        payload: fallbackPayload,
        score: fallbackPayload ? 100 : 0,
        attemptsUsed: 0,
        qualityHints: result.qualityHints || {},
      });
    }
    const failureReason = buildMrzFailureReason(result, true);
    return res.status(400).json({
      message: 'Görüntüde MRZ bulunamadı.',
      failureReason,
      qualityHints: result.qualityHints || {},
    });
  } catch (error) {
    console.error('OCR MRZ hatası:', error);
    const failureReason = 'Sunucu hatası: ' + (error.message || 'MRZ işlenemedi.');
    res.status(500).json({ message: 'MRZ okunamadı', error: error.message, failureReason });
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

/** Galeriden seçilen görsel: base64 ile gönder (Android content URI FormData sorununu aşar). MRZ için runMrzPipeline kullan (kimlik MRZ canavarı). */
router.post('/document-base64', authenticateTesisOrSupabase, express.json({ limit: '8mb' }), async (req, res) => {
  const base64 = req.body?.imageBase64;
  let filePath = null;
  const logPrefix = '[document-base64]';
  try {
    if (!base64 || typeof base64 !== 'string') {
      console.warn(logPrefix, 'body.imageBase64 yok veya string değil');
      return res.status(400).json({ message: 'imageBase64 gerekli' });
    }
    const buf = Buffer.from(base64, 'base64');
    if (buf.length === 0) {
      console.warn(logPrefix, 'base64 decode sonrası buffer boş');
      return res.status(400).json({ message: 'Geçersiz görüntü' });
    }
    console.log(logPrefix, 'görsel kaydediliyor', { bufLen: buf.length });
    if (!fs.existsSync(KIMLIK_UPLOAD_DIR)) {
      fs.mkdirSync(KIMLIK_UPLOAD_DIR, { recursive: true });
    }
    filePath = path.join(KIMLIK_UPLOAD_DIR, `base64_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`);
    fs.writeFileSync(filePath, buf);
    console.log(logPrefix, 'runMrzPipeline başlıyor');
    const mrzResult = await runMrzPipeline(filePath);
    console.log(logPrefix, 'runMrzPipeline bitti', { ok: mrzResult.ok, hasMrzRaw: !!mrzResult.mrzRaw, score: mrzResult.score, attemptsUsed: mrzResult.attemptsUsed });
    let mrzRaw = mrzResult.mrzRaw || null;
    let mrzPayload = mrzResult.payload || null;
    if (!mrzPayload && mrzRaw) mrzPayload = parseMrzToPayload(mrzRaw);
    const mrzFailureReason = !mrzRaw ? buildMrzFailureReason(mrzResult, false) : null;
    console.log(logPrefix, 'Tesseract ön yüz OCR başlıyor');
    const { data: { text } } = await Tesseract.recognize(filePath, 'eng+ara+tur', { logger: () => {} });
    const front = parseIdentityDocument(text);
    const merged = mergeMrzAndFront(mrzPayload, front);
    console.log(logPrefix, 'tamamlandı', { mrzRawLen: mrzRaw?.length ?? 0, mergedKeys: Object.keys(merged || {}) });
    res.json({
      success: true,
      rawText: text,
      mrz: mrzRaw || null,
      mrzPayload: mrzPayload || null,
      mrzFailureReason: mrzFailureReason || undefined,
      front,
      merged,
    });
  } catch (error) {
    console.error(logPrefix, 'hata:', error.message);
    console.error(logPrefix, 'stack:', error.stack);
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
  if (one.length >= 86 && one.length <= 90 && one.length !== 90 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 44).padEnd(44, '<'), one.slice(44).padEnd(44, '<')];
  }
  if (one.length >= 86 && one.length <= 94 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 30).padEnd(30, '<'), one.slice(30, 60).padEnd(30, '<'), one.slice(60).padEnd(30, '<')];
  }
  if (one.length >= 70 && one.length <= 74 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 36).padEnd(36, '<'), one.slice(36, 72).padEnd(36, '<')];
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
  if (lines.length >= 2 && lines[0].length >= 38) {
    const l1 = (lines[0] || '').padEnd(44, '<');
    const l2 = (lines[1] || '').padEnd(44, '<');
    docNumber = l2.substring(0, 9).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(13, 19));
    expiryDate = normalizeYYMMDD(l2.substring(21, 27));
    issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
    const nameBlock = l1.substring(5, 44);
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
  } else if (lines.length >= 3 && lines[0].length >= 26) {
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
    const mrzUyruk = (mrzPayload.nationality || mrzPayload.issuingCountry || '').trim().toUpperCase();
    if (mrzUyruk) merged.uyruk = mrzUyruk;
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

