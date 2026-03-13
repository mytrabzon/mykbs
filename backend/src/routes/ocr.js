const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { authenticateTesisOrSupabase } = require('../middleware/authTesisOrSupabase');
const { tenantMiddleware } = require('../middleware/tenant');
const {
  cropBottomFraction,
  cropTopFraction,
  cropCenterFraction,
  preprocessForKimlikMrz,
  preprocessForTurkishIdMrz,
  preprocessForPaperMrz,
  preprocessForPhotocopyMrz,
  preprocessForPhotocopyMrzStrong,
  preprocessForFadedMrz,
  preprocessForInvertedMrz,
  preprocessMrzImage,
  preprocessForMRZ,
  cropMrzCandidates,
  rotateImage,
  cropPortraitFromDocument,
} = require('../lib/vision/preprocess');
const { parseMrzRaw, extractMultipleMRZ, extractMrzWithMultipleAttempts } = require('../lib/vision/mrz');

const router = express.Router();
const KIMLIK_UPLOAD_DIR = path.join(__dirname, '../../uploads/kimlikler');

/** document-base64: aynı client'tan çok hızlı tekrar istek (fotokopi/A4 aynı MRZ) engelleme. Android otomatik MRZ her ~1.6s çekim yaptığı için 5s çok agresif; ~1s ile her çekim geçer. */
const documentBase64RateLimit = new Map();
const DOCUMENT_BASE64_TTL_MS = 1100;

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

/** OCR çıktısından MRZ satır adayları: kimlik/pasaport/fotokopi. Fotokopide satır bölünebilir; 18+ kabul, birleştirme dene. */
function extractMrzLinesFromOcr(text) {
  if (!text || typeof text !== 'string') return [];
  const rawLines = text.split(/\r\n|\r|\n/)
    .map((l) => l.trim().toUpperCase().replace(/\s/g, '').replace(/[\u00AB\u2039\u203A\u00BB]/g, '<'))
    .map((l) => l.replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 10);
  // Fotokopi: ardışık kısa satırları birleştir (örn. 15+15 → 30, 22+22 → 44)
  const merged = [];
  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    if (line.length >= 26 && line.length <= 48) {
      merged.push(line);
      i++;
      continue;
    }
    if (line.length >= 20 && line.length <= 34) {
      merged.push(line);
      i++;
      continue;
    }
    let combined = line;
    let j = i + 1;
    while (j < rawLines.length && combined.length < 42) {
      const next = rawLines[j];
      const joined = combined + next;
      if (joined.length >= 28 && joined.length <= 34) {
        merged.push(joined.slice(0, 30));
        i = j + 1;
        break;
      }
      if (joined.length >= 35 && joined.length <= 48) {
        merged.push(joined.slice(0, 44));
        i = j + 1;
        break;
      }
      if (joined.length >= 44 && joined.length <= 52) {
        merged.push(joined.slice(0, 44));
        i = j + 1;
        break;
      }
      combined = joined;
      j++;
    }
    if (j >= rawLines.length) {
      if (combined.length >= 20 && combined.length <= 48) merged.push(combined.slice(0, 48));
      i++;
    }
  }
  const lines = merged.length > 0 ? merged : rawLines.filter((l) => l.length >= 20);
  const withAngle = lines.filter((l) => l.includes('<'));
  const twoLine44 = lines.filter((l) => l.length >= 35 && l.length <= 48);
  const threeLine30 = lines.filter((l) => l.length >= 22 && l.length <= 34);
  const candidates = threeLine30.length >= 3 ? threeLine30.slice(0, 3)
    : (withAngle.length >= 2 ? withAngle : (twoLine44.length >= 2 ? twoLine44 : lines));
  return candidates.filter((l) => l.length >= 18 && l.length <= 48);
}

/** OCR çıktısından MRZ benzeri satırları bul (TD1: 3x30 kimlik, TD2: 2x36, TD3: 2x44 pasaport). Esnek aralıklar. */
function extractMrzFromOcr(text) {
  if (!text || typeof text !== 'string') return '';
  const lines = extractMrzLinesFromOcr(text);
  if (lines.length >= 3 && lines.every((l) => l.length >= 22 && l.length <= 34)) {
    return lines.slice(0, 3).map((l) => padMrzLine(l, 30)).join('\n');
  }
  if (lines.length >= 3 && lines.some((l) => l.length >= 24 && l.length <= 32)) {
    const take = lines.filter((l) => l.length >= 24 && l.length <= 32).slice(0, 3);
    if (take.length >= 3) return take.map((l) => padMrzLine(l, 30)).join('\n');
  }
  const normalized = normalizeOcrTextForMrz(text);
  const one = normalized.trim();
  // 88 karakter = pasaport (TD3 2×44); TD1 (3×30) ile çakışmasın
  if (one.length >= 78 && one.length <= 96 && one.length !== 88 && /^[A-Z0-9<]+$/.test(one)) {
    const a = 30, b = 60;
    const s1 = padMrzLine(one.slice(0, a), 30);
    const s2 = padMrzLine(one.slice(a, b), 30);
    const s3 = padMrzLine(one.slice(b), 30);
    return s1 + '\n' + s2 + '\n' + s3;
  }
  if (one.length >= 76 && one.length <= 98 && /^[A-Z0-9<]+$/.test(one)) {
    const a = 44;
    const s1 = padMrzLine(one.slice(0, a), 44);
    const s2 = padMrzLine(one.slice(a, one.length), 44);
    return s1 + '\n' + s2;
  }
  if (one.length >= 66 && one.length <= 78 && /^[A-Z0-9<]+$/.test(one)) {
    const s1 = padMrzLine(one.slice(0, 36), 36);
    const s2 = padMrzLine(one.slice(36, 72), 36);
    return s1 + '\n' + s2;
  }
  if (lines.length >= 2 && lines.every((l) => l.length >= 35 && l.length <= 48)) {
    return lines.slice(0, 2).map((l) => padMrzLine(l, 44)).join('\n');
  }
  if (lines.length >= 2 && lines.every((l) => l.length >= 28 && l.length <= 40)) {
    return lines.slice(0, 2).map((l) => padMrzLine(l, 36)).join('\n');
  }
  if (lines.length >= 2) {
    const l0 = lines[0].length, l1 = lines[1].length;
    if (l0 >= 35 && l1 >= 35) return padMrzLine(lines[0], 44) + '\n' + padMrzLine(lines[1], 44);
    if (l0 >= 28 && l1 >= 28) return padMrzLine(lines[0], 36) + '\n' + padMrzLine(lines[1], 36);
    if (l0 >= 20 && l1 >= 20) return padMrzLine(lines[0], 30) + '\n' + padMrzLine(lines[1], 30);
  }
  if (lines.length >= 3) return lines.slice(0, 3).map((l) => padMrzLine(l, 30)).join('\n');
  if (lines.length === 1 && lines[0].length >= 20) return padMrzLine(lines[0], 30);

  // Kağıt/fotokopi: OCR tüm sayfayı tek blok verince "one" 80–96 olmaz. Uzun metinde MRZ benzeri alt dizi ara.
  if (one.length >= 80) {
    let match;
    const td3Re = /[A-Z0-9<]{80,96}/g;
    while ((match = td3Re.exec(one)) !== null) {
      const block = match[0];
      if (block.length === 88 || (block.length >= 80 && block.length <= 96 && (block.match(/</g) || []).length >= 2)) {
        const s1 = padMrzLine(block.slice(0, 44), 44);
        const s2 = padMrzLine(block.slice(44, 88), 44);
        return s1 + '\n' + s2;
      }
    }
    const td1Re = /[A-Z0-9<]{86,94}/g;
    while ((match = td1Re.exec(one)) !== null) {
      const block = match[0];
      if (block.length !== 88 && (block.match(/</g) || []).length >= 2) {
        const s1 = padMrzLine(block.slice(0, 30), 30);
        const s2 = padMrzLine(block.slice(30, 60), 30);
        const s3 = padMrzLine(block.slice(60), 30);
        return s1 + '\n' + s2 + '\n' + s3;
      }
    }
  }
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
/** Tarih alanlarında (YYMMDD) OCR rakam karışıklıkları – soluk/fotokopi/kağıt baskıda sık görülen. */
const OCR_DATE_FIXES = {
  O: '0', Q: '0', D: '0', U: '0',
  I: '1', L: '1', '|': '1', J: '1',
  Z: '2', V: '2',
  E: '3',
  A: '4', H: '4',
  S: '5',
  G: '6', C: '6',
  T: '7', Y: '7',
  B: '8', R: '8',
  P: '9',
};
/** Belge no / check digit – sadece en yaygın karışıklıklar (alfanumerik alanda D vb. harf olabilir). */
const OCR_DIGIT_SAFE = { O: '0', Q: '0', I: '1', L: '1', '|': '1', S: '5', B: '8', Z: '2' };
function fixLineDigitPositions(line, digitRanges) {
  if (!line) return line;
  const arr = line.split('');
  for (const [start, end] of digitRanges) {
    const isDateRange = start >= 13 && end <= 29; /* YYMMDD + check digit alanları */
    const map = isDateRange ? OCR_DATE_FIXES : OCR_DIGIT_SAFE;
    for (let i = start; i < end && i < arr.length; i++) {
      const c = arr[i];
      const fix = map[c];
      if (fix) arr[i] = fix;
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
 * @param {{ paperMode?: boolean }} [opts] - paperMode: true ise kağıt/fotokopi varyantları önce denenir (daha hızlı sonuç)
 * @returns {Promise<{ ok: boolean, mrzRaw?: string, payload?: object, score?: number, attemptsUsed?: number, qualityHints?: object }>}
 */
async function runMrzPipeline(filePath, opts = {}) {
  const paperMode = !!opts.paperMode;
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

  const allVariants = [
    { fn: async (p) => { const buf = fs.readFileSync(p); const img = await preprocessForMRZ(buf); await img.writeAsync(p); }, name: 'mrzStrong' },
    { fn: (p) => preprocessMrzImage(p, { mrzFraction: 0.3, contrast: 0.3, brightness: 0.2 }), name: 'mrzCrop' },
    { fn: preprocessForPhotocopyMrz, name: 'photocopy' },
    { fn: preprocessForPaperMrz, name: 'paper' },
    { fn: preprocessForPhotocopyMrzStrong, name: 'photocopyStrong' },
    { fn: preprocessForFadedMrz, name: 'faded' },
    { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.45 }), name: 'kimlikLow' },
    { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.55 }), name: 'kimlik' },
    { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.65 }), name: 'kimlikMid' },
    { fn: (p) => preprocessForKimlikMrz(p, { contrast: 0.8 }), name: 'kimlikHi' },
    { fn: (p) => preprocessForKimlikMrz(p, { sharpen: true }), name: 'kimlikSharp' },
    { fn: preprocessForInvertedMrz, name: 'inverted' },
  ];
  const docTypeHint = opts.docTypeHint === 'id' ? 'id' : undefined;
  const preprocessVariants = paperMode
    ? [
        ...(docTypeHint === 'id' ? [{ fn: preprocessForTurkishIdMrz, name: 'turkishId' }] : []),
        { fn: preprocessForPaperMrz, name: 'paper' },
        { fn: preprocessForPhotocopyMrzStrong, name: 'photocopyStrong' },
        { fn: preprocessForFadedMrz, name: 'faded' },
        { fn: preprocessForPhotocopyMrz, name: 'photocopy' },
        ...allVariants.filter((v) => !['paper', 'photocopyStrong', 'faded', 'photocopy'].includes(v.name)),
      ]
    : allVariants;

  try {
    const worker = await Tesseract.createWorker('eng', 1, { logger: () => {} });

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
          const parseOpts = docTypeHint ? { docTypeHint } : {};
          let parsed = parseMrzRaw(raw, parseOpts);
          if (!parsed) {
            for (let pass = 0; pass < 3; pass++) {
              fixed = fixMrzOcrErrorsBackend(fixed || raw);
              parsed = parseMrzRaw(fixed, parseOpts);
              if (parsed) break;
            }
          } else if (parsed.checks && !parsed.checks.compositeCheck) {
            fixed = fixMrzOcrErrorsBackend(raw);
            const reparsed = parseMrzRaw(fixed, parseOpts);
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

    // Önce tam görüntüyü dene (net olmasa bile en iyi sonucu almak için)
    await tryImage(filePath);

    for (const frac of bottomFractions) {
      const cropPath = path.join(dir, `crop_bottom_${frac}.jpg`);
      await cropBottomFraction(filePath, frac, cropPath);
      registerTemp(cropPath);
      if (await tryImage(cropPath)) break;
    }

    if (best.score < 100) {
      const topFractions = [0.35, 0.30, 0.40, 0.25];
      for (const frac of topFractions) {
        const cropPath = path.join(dir, `crop_top_${frac}.jpg`);
        await cropTopFraction(filePath, frac, cropPath);
        registerTemp(cropPath);
        if (await tryImage(cropPath)) break;
      }
    }

    // A4 / fotokopi: MRZ sayfa ortasında veya alt-ortada olabilir; orta bant crop dene
    if (best.score < 100) {
      let imgW = 0, imgH = 0;
      try {
        const Jimp = (await import('jimp')).default;
        const meta = await Jimp.read(filePath);
        imgW = meta.bitmap.width;
        imgH = meta.bitmap.height;
      } catch (_) {}
      const looksLikePage = imgW > 400 && imgH > 400 && imgW / imgH > 0.5 && imgW / imgH < 2.2;
      if (looksLikePage) {
        for (const frac of [0.5, 0.45, 0.4]) {
          const cropPath = path.join(dir, `crop_center_${frac}.jpg`);
          await cropCenterFraction(filePath, frac, cropPath);
          registerTemp(cropPath);
          if (await tryImage(cropPath)) break;
        }
      }
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

  // Parse edilebilen her sonucu "en iyi çaba" olarak kabul et; kullanıcı gerekirse düzeltir
  const ok = !!(best.raw && best.payload);
  return {
    ok,
    mrzRaw: best.raw || undefined,
    payload: best.payload || undefined,
    score: best.score,
    attemptsUsed: best.attemptsUsed,
    qualityHints,
  };
}

/** MRZ bulunamadığında kullanıcıya gösterilecek sebep metni. Sistem en iyi sonucu almaya çalıştı. */
function buildMrzFailureReason(mrzResult, fallbackAlsoFailed) {
  const attempts = (mrzResult && mrzResult.attemptsUsed) || 0;
  const parts = [];
  parts.push('Sistem en iyi sonucu almaya çalıştı.');
  if (attempts > 0) {
    parts.push(`${attempts} farklı okuma denemesi yapıldı; MRZ satırı tespit edilemedi.`);
  }
  parts.push('Gerekirse alanları manuel girin veya MRZ bandı daha net görünecek şekilde tekrar çekin.');
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

/** Çoklu MRZ: görüntüde birden fazla pasaport/kimlik (yan yana) varsa hepsini döndürür. */
router.post('/mrz-multi', authenticateTesisOrSupabase, express.json({ limit: '8mb' }), async (req, res) => {
  try {
    const base64 = req.body?.imageBase64;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 gerekli' });
    }
    const imageBuffer = Buffer.from(base64, 'base64');
    if (imageBuffer.length === 0) {
      return res.status(400).json({ error: 'Geçersiz görüntü' });
    }
    const mrzList = await extractMultipleMRZ(imageBuffer);
    if (mrzList.length === 0) {
      const singleResult = await extractMrzWithMultipleAttempts(imageBuffer);
      return res.json({
        success: true,
        multiple: false,
        mrz: singleResult?.text || null,
        mrzPayload: singleResult?.text ? parseMrzToPayload(singleResult.text) : null,
        mrzList: [],
      });
    }
    const docTypeHint = req.body?.docTypeHint === 'id' ? 'id' : undefined;
    const listWithPayload = mrzList.map((m) => ({
      text: m.text,
      confidence: m.confidence,
      payload: parseMrzToPayload(m.text) || undefined,
    }));
    res.json({
      success: true,
      multiple: mrzList.length > 1,
      mrzList: listWithPayload,
      mrz: mrzList.length === 1 ? mrzList[0].text : null,
      mrzPayload: mrzList.length === 1 ? parseMrzToPayload(mrzList[0].text) : null,
    });
  } catch (error) {
    console.error('[mrz-multi] hata:', error.message);
    res.status(500).json({ error: error.message });
  }
});

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
    let portraitBase64 = null;
    try {
      portraitBase64 = await cropPortraitFromDocument(filePath);
    } catch (_) {}
    res.json({
      success: true,
      rawText: rawText,
      mrz: mrzRaw || null,
      mrzPayload: mrzPayload || null,
      front,
      merged,
      portraitBase64: portraitBase64 || undefined,
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

/** Galeriden seçilen görsel: base64 ile gönder (Android content URI FormData sorununu aşar). MRZ için runMrzPipeline kullan (kimlik MRZ canavarı). paperMode: true ile kağıt/fotokopi ön işlemi öncelikli. */
router.post('/document-base64', authenticateTesisOrSupabase, tenantMiddleware, express.json({ limit: '8mb' }), async (req, res) => {
  // OCR uzun sürebilir; 502 "Application failed to respond" önlemek için bu istek için timeout artır (2 dk)
  res.setTimeout(120000);
  const base64 = req.body?.imageBase64;
  const paperMode = !!req.body?.paperMode;
  let filePath = null;
  const logPrefix = '[document-base64]';
  const clientId = req.headers['x-client-id'] || req.ip || 'unknown';

  try {
    console.log(logPrefix, 'istek (kimlik/pasaport okuma)', { paperMode, base64Len: base64?.length ?? 0, clientId: clientId.slice(0, 24) });
    const lastRequest = documentBase64RateLimit.get(clientId);
    if (lastRequest && Date.now() - lastRequest < DOCUMENT_BASE64_TTL_MS) {
      console.log(logPrefix, 'Çok hızlı tekrar istek, engellendi', { clientId: clientId.slice(0, 20) });
      return res.status(429).json({ error: 'Çok hızlı istek', retryAfter: 1 });
    }
    documentBase64RateLimit.set(clientId, Date.now());

    if (!base64 || typeof base64 !== 'string') {
      console.warn(logPrefix, "Storage'a yazılmadı: body.imageBase64 yok veya string değil. Neden: istek gövdesinde imageBase64 alanı eksik veya geçersiz tipte.");
      return res.status(400).json({ message: 'imageBase64 gerekli' });
    }
    let buf;
    try {
      buf = Buffer.from(base64, 'base64');
    } catch (decodeErr) {
      console.warn(logPrefix, "Storage'a yazılmadı: base64 decode hatası. Neden:", decodeErr.message, "- Geçersiz base64 karakter veya format (data:image/... prefix bırakılmış olabilir).");
      return res.status(400).json({ message: 'Geçersiz görüntü (base64 format hatası)' });
    }
    if (buf.length === 0) {
      console.warn(logPrefix, "Storage'a yazılmadı: base64 decode sonrası buffer boş. Neden: base64 string geçerli ama decode edilmiş veri 0 byte (boş görsel).");
      return res.status(400).json({ message: 'Geçersiz görüntü' });
    }
    if (!fs.existsSync(KIMLIK_UPLOAD_DIR)) {
      fs.mkdirSync(KIMLIK_UPLOAD_DIR, { recursive: true });
    }
    filePath = path.join(KIMLIK_UPLOAD_DIR, `base64_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`);
    try {
      const Jimp = (await import('jimp')).default;
      const img = await Jimp.read(buf);
      await img.write(filePath);
      console.log(logPrefix, "Storage'a yazıldı (Jimp normalize):", filePath, { bufLen: buf.length });
    } catch (normalizeErr) {
      console.warn(logPrefix, 'Jimp okuma/yazma hatası:', normalizeErr.message, '- Ham buffer .jpg olarak deneniyor.');
      filePath = path.join(KIMLIK_UPLOAD_DIR, `base64_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`);
      try {
        fs.writeFileSync(filePath, buf);
      } catch (writeErr) {
        console.error(logPrefix, "Storage yazma hatası:", writeErr.message);
        return res.status(400).json({ message: 'Görsel formatı desteklenmiyor veya bozuk. JPEG/PNG deneyin.' });
      }
    }
    const requestDocTypeHint = req.body?.docTypeHint === 'id' ? 'id' : undefined;
    let mrzRaw = null;
    let mrzPayload = null;
    let mrzFailureReason = null;
    let mrzResult = { ok: false, attemptsUsed: 0, score: 0 };
    let mrzList = [];
    let multiple = false;

    if (paperMode && buf && buf.length > 0) {
      try {
        mrzList = await extractMultipleMRZ(buf);
        if (mrzList.length > 0) {
          // Tek pasaport odaklı: docTypeHint id değilse sadece 2 satır (TD3 pasaport) kullan; id ise 3 satır (TD1).
          const lineCountFor = (text) => (text || '').trim().split('\n').filter(Boolean).length;
          let candidates = mrzList;
          if (requestDocTypeHint === 'id') {
            const td1Only = mrzList.filter((m) => lineCountFor(m.text) >= 3);
            if (td1Only.length > 0) candidates = td1Only;
          } else {
            const td3Only = mrzList.filter((m) => lineCountFor(m.text) === 2);
            if (td3Only.length > 0) candidates = td3Only;
          }
          const best = candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
          mrzRaw = best.text;
          mrzPayload = parseMrzToPayload(best.text) || null;
          multiple = mrzList.length > 1;
          console.log(logPrefix, 'çoklu MRZ pipeline', { count: mrzList.length, candidates: candidates.length, multiple, bestConf: best.confidence });
        }
      } catch (multiErr) {
        console.warn(logPrefix, 'extractMultipleMRZ atlandı', multiErr.message);
      }
    }

    if (!mrzRaw) {
      console.log(logPrefix, 'runMrzPipeline başlıyor', { paperMode, docTypeHint: requestDocTypeHint });
      mrzResult = await runMrzPipeline(filePath, { paperMode, docTypeHint: requestDocTypeHint });
      mrzRaw = mrzResult.mrzRaw || null;
      mrzPayload = mrzResult.payload || null;
      if (!mrzPayload && mrzRaw) mrzPayload = parseMrzToPayload(mrzRaw);
      mrzFailureReason = !mrzRaw ? buildMrzFailureReason(mrzResult, false) : null;
      const lineCount = mrzRaw ? mrzRaw.trim().split('\n').filter(Boolean).length : 0;
      const inferredDocType = mrzRaw ? (lineCount >= 3 ? 'TC_KIMLIK (TD1, 3 satır)' : 'PASAPORT (TD3, 2 satır)') : null;
      console.log(logPrefix, 'runMrzPipeline bitti', { ok: mrzResult.ok, hasMrzRaw: !!mrzRaw, docType: inferredDocType, score: mrzResult.score, attemptsUsed: mrzResult.attemptsUsed });
      if (!mrzRaw && mrzFailureReason) console.log(logPrefix, 'MRZ bulunamadı', { reason: mrzFailureReason.slice(0, 120) });
    }
    let text = '';
    let front = {};
    try {
      console.log(logPrefix, 'Tesseract ön yüz OCR başlıyor');
      const { data } = await Tesseract.recognize(filePath, 'eng+ara+tur', { logger: () => {} });
      text = data?.text || '';
      front = parseIdentityDocument(text);
    } catch (ocrErr) {
      console.warn(logPrefix, 'Tesseract ön yüz OCR hatası (sunucu çökmemesi için yakalandı):', ocrErr.message);
    }
    const merged = mergeMrzAndFront(mrzPayload, front);
    let portraitBase64 = null;
    try {
      portraitBase64 = await cropPortraitFromDocument(filePath);
      if (portraitBase64) console.log(logPrefix, 'kimlik resmi kırpıldı', { len: portraitBase64.length });
    } catch (portraitErr) {
      console.warn(logPrefix, 'kimlik resmi kırpma atlandı:', portraitErr?.message);
    }
    const scanId = Date.now();
    const timestamp = new Date().toISOString();
    console.log(logPrefix, 'tamamlandı', { mrzRawLen: mrzRaw?.length ?? 0, mergedKeys: Object.keys(merged || {}), scanId, multiple: !!multiple });
    const responsePayload = {
      success: true,
      rawText: text,
      mrz: mrzRaw || null,
      mrzPayload: mrzPayload || null,
      mrzFailureReason: mrzFailureReason || undefined,
      front,
      merged,
      portraitBase64: portraitBase64 || undefined,
      scanId,
      timestamp,
    };
    if (multiple && mrzList.length > 1) {
      responsePayload.multiple = true;
      responsePayload.mrzCount = mrzList.length;
      responsePayload.mrzList = mrzList.map((m) => ({
        text: m.text,
        confidence: m.confidence,
        payload: parseMrzToPayload(m.text) || undefined,
      }));
    }
    res.json(responsePayload);
  } catch (error) {
    console.error(logPrefix, 'hata:', error.message);
    console.error(logPrefix, 'stack:', error.stack);
    res.status(500).json({ message: 'Belge okunamadı', error: error.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
    setTimeout(() => documentBase64RateLimit.delete(clientId), DOCUMENT_BASE64_TTL_MS * 2);
  }
});

/** Galeriden ön + arka yüz: iki görsel base64. Arka yüzden MRZ, ön yüzden OCR; birleştirilmiş tam veri döner. */
router.post('/document-front-back', authenticateTesisOrSupabase, express.json({ limit: '16mb' }), async (req, res) => {
  const frontBase64 = req.body?.frontBase64;
  const backBase64 = req.body?.backBase64;
  let frontPath = null;
  let backPath = null;
  const logPrefix = '[document-front-back]';
  try {
    if (!frontBase64 || !backBase64 || typeof frontBase64 !== 'string' || typeof backBase64 !== 'string') {
      console.warn(logPrefix, "Storage'a yazılmadı: frontBase64 ve backBase64 gerekli. Neden: istek gövdesinde biri veya ikisi eksik/geçersiz tip.");
      return res.status(400).json({ message: 'frontBase64 ve backBase64 gerekli' });
    }
    let frontBuf;
    let backBuf;
    try {
      frontBuf = Buffer.from(frontBase64, 'base64');
      backBuf = Buffer.from(backBase64, 'base64');
    } catch (decodeErr) {
      console.warn(logPrefix, "Storage'a yazılmadı: base64 decode hatası. Neden:", decodeErr.message, "- Ön veya arka görsel geçersiz base64.");
      return res.status(400).json({ message: 'Geçersiz görsel (base64 format hatası)' });
    }
    if (frontBuf.length === 0 || backBuf.length === 0) {
      console.warn(logPrefix, "Storage'a yazılmadı: base64 decode sonrası buffer boş. Neden: ön veya arka decode 0 byte.", { frontLen: frontBuf.length, backLen: backBuf.length });
      return res.status(400).json({ message: 'Geçersiz görsel (base64)' });
    }
    if (!fs.existsSync(KIMLIK_UPLOAD_DIR)) fs.mkdirSync(KIMLIK_UPLOAD_DIR, { recursive: true });
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    frontPath = path.join(KIMLIK_UPLOAD_DIR, `front_${id}.jpg`);
    backPath = path.join(KIMLIK_UPLOAD_DIR, `back_${id}.jpg`);
    try {
      fs.writeFileSync(frontPath, frontBuf);
      fs.writeFileSync(backPath, backBuf);
      console.log(logPrefix, "Storage'a yazıldı: ön ve arka", { frontPath, backPath, frontLen: frontBuf.length, backLen: backBuf.length });
    } catch (writeErr) {
      console.error(logPrefix, "Storage yazma hatası:", writeErr.message, "- ön/arka path:", frontPath, backPath);
      [frontPath, backPath].forEach((p) => { if (p && fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (_) {} } });
      return res.status(500).json({ message: 'Görsel kaydedilemedi', error: writeErr.message });
    }
    console.log(logPrefix, 'MRZ arka yüzde aranıyor');
    const mrzResult = await runMrzPipeline(backPath);
    const mrzRaw = mrzResult.mrzRaw || null;
    let mrzPayload = mrzResult.payload || null;
    if (!mrzPayload && mrzRaw) mrzPayload = parseMrzToPayload(mrzRaw);
    const mrzFailureReason = !mrzRaw ? buildMrzFailureReason(mrzResult, false) : null;
    console.log(logPrefix, 'Ön yüz OCR başlıyor');
    const { data: { text: frontText } } = await Tesseract.recognize(frontPath, 'eng+ara+tur', { logger: () => {} });
    const front = parseIdentityDocument(frontText);
    const merged = mergeMrzAndFront(mrzPayload, front);
    let portraitBase64 = null;
    try {
      portraitBase64 = await cropPortraitFromDocument(frontPath);
    } catch (_) {}
    console.log(logPrefix, 'tamamlandı', { hasMrz: !!mrzRaw, mergedKeys: Object.keys(merged || {}), hasPortrait: !!portraitBase64 });
    res.json({
      success: true,
      rawText: frontText,
      mrz: mrzRaw || null,
      mrzPayload: mrzPayload || null,
      mrzFailureReason: mrzFailureReason || undefined,
      front,
      merged,
      portraitBase64: portraitBase64 || undefined,
    });
  } catch (error) {
    console.error(logPrefix, 'hata:', error.message);
    res.status(500).json({ message: 'Belge okunamadı', error: error.message });
  } finally {
    [frontPath, backPath].forEach((p) => {
      if (p && fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (_) {} }
    });
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
  if (one.length >= 86 && one.length <= 94 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 30).padEnd(30, '<'), one.slice(30, 60).padEnd(30, '<'), one.slice(60).padEnd(30, '<')];
  }
  if (one.length >= 80 && one.length <= 96 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 44).padEnd(44, '<'), one.slice(44).padEnd(44, '<')];
  }
  if (one.length >= 70 && one.length <= 74 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 36).padEnd(36, '<'), one.slice(36, 72).padEnd(36, '<')];
  }
  return (raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.trim().toUpperCase().replace(/\s/g, '')).filter(Boolean);
}

/** Pasaport/kimlik MRZ'de OCR sık harf–rakam karıştırır (0/O, 1/I, 5/S). Tarih alanı 6 karakterde bunları düzelt. */
function fixMrzDateOcrChars(s) {
  if (!s || s.length < 6) return s;
  const map = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
  return s.substring(0, 6).split('').map((c) => map[c] || c).join('');
}

/** MRZ tarih alanı sadece 6 rakam (YYMMDD). OCR hatalı okuyunca harf/< gelirse boş dön; rastgele tarih üretme. */
function normalizeYYMMDD(yymmdd) {
  if (!yymmdd || typeof yymmdd !== 'string' || yymmdd.length < 6) return '';
  let raw = yymmdd.substring(0, 6).replace(/</g, '0');
  raw = fixMrzDateOcrChars(raw);
  if (!/^\d{6}$/.test(raw)) return '';
  const yy = parseInt(raw.substring(0, 2), 10);
  const mm = raw.substring(2, 4);
  const dd = raw.substring(4, 6);
  const mmNum = parseInt(mm, 10);
  const ddNum = parseInt(dd, 10);
  if (mmNum < 1 || mmNum > 12 || ddNum < 1 || ddNum > 31) return '';
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
    const l1 = (lines[0] || '').slice(0, 44).padEnd(44, '<');
    const l2 = (lines[1] || '').slice(0, 44).padEnd(44, '<');
    docNumber = l2.substring(0, 9).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(13, 19));
    expiryDate = normalizeYYMMDD(l2.substring(21, 27));
    issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
    const nameBlock = l1.substring(5, 44);
    const parts = nameBlock.split(/<+/).map((s) => s.replace(/</g, ' ').trim()).filter(Boolean);
    surname = (parts[0] || '').trim();
    givenNames = (parts.slice(1).join(' ') || '').trim();
  } else if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) {
    const l2 = (lines[1] || '').padEnd(36, '<');
    docNumber = l2.substring(0, 9).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(13, 19));
    expiryDate = normalizeYYMMDD(l2.substring(21, 27));
    issuingCountry = (lines[0] || '').substring(2, 5).replace(/</g, '').trim();
    const nameBlock = (lines[0] || '').substring(5, 36);
    const parts = nameBlock.split(/<+/).map((s) => s.replace(/</g, ' ').trim()).filter(Boolean);
    surname = (parts[0] || '').trim();
    givenNames = (parts.slice(1).join(' ') || '').trim();
  } else if (lines.length >= 3 && lines[0].length >= 26) {
    const l1 = (lines[0] || '').padEnd(30, '<');
    const l2 = (lines[1] || '').padEnd(30, '<');
    const l3 = (lines[2] || '').padEnd(30, '<');
    docNumber = l1.substring(5, 14).replace(/</g, '').trim();
    birthDate = normalizeYYMMDD(l2.substring(0, 6));
    expiryDate = normalizeYYMMDD(l2.substring(8, 14));
    issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
    // TD1 satır 3: SOYAD<<AD — OCR bazen tek < okur; /<+/ ile her iki durumda doğru ayrışır
    const nameParts = l3.split(/<+/).map((s) => s.trim()).filter(Boolean);
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
    if (mrzPayload.surname != null && mrzPayload.surname !== '') merged.soyad = String(mrzPayload.surname).trim();
    if (mrzPayload.givenNames != null && mrzPayload.givenNames !== '') merged.ad = String(mrzPayload.givenNames).trim();
    // Türkiye Cumhuriyeti kimlik kartı: MRZ'de TUR + 11 hane (personalNumber/optional data veya documentNumber) → kimlikNo
    const issuingCountry = (mrzPayload.issuingCountry || '').trim().toUpperCase();
    const personalNo = String(mrzPayload.personalNumber || '').replace(/\D/g, '');
    const docNo = String(mrzPayload.documentNumber || '').replace(/\D/g, '');
    if (issuingCountry === 'TUR' && /^\d{11}$/.test(personalNo)) {
      merged.kimlikNo = personalNo;
      merged.pasaportNo = null;
    } else if (issuingCountry === 'TUR' && /^\d{11}$/.test(docNo)) {
      merged.kimlikNo = docNo;
      merged.pasaportNo = null;
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

