/**
 * MRZ: crop detection (use full image for now), OCR, parse, check digits, confidence.
 * Used by POST /scan/mrz/parse.
 */

const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

const TD3_LINE_LEN = 44;
const TD2_LINE_LEN = 36;
const TD1_LINE_LEN = 30;

function checkDigit(s) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = c === '<' ? 0 : (c >= '0' && c <= '9') ? parseInt(c, 10) : (c >= 'A' && c <= 'Z') ? c.charCodeAt(0) - 55 : 0;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

function padMrzLine(line, targetLen) {
  if (!line || targetLen < 1) return line;
  return line.padEnd(targetLen, '<').slice(0, targetLen);
}

/** Extract MRZ-like lines from OCR text (TD1 3x30, TD2 2x36, TD3 2x44). Fotokopi/farklı pasaportlarda OCR uzunluğu 80–96 arası değişebilir; tek blok TD3 aralığı buna göre geniş. */
function extractMrzFromOcr(text) {
  if (!text || typeof text !== 'string') return '';
  const one = text.replace(/\s/g, '').trim().toUpperCase().replace(/[^A-Z0-9<]/g, '');
  if (one.length >= 70 && one.length <= 74) {
    const s1 = padMrzLine(one.slice(0, 36), 36);
    const s2 = padMrzLine(one.slice(36, 72), 36);
    return s1 + '\n' + s2;
  }
  // TD1 (kimlik 3×30): 90 karakter; 86–94 aralığı (88 = pasaport, atla). TD3’ten önce kontrol et.
  if (one.length >= 86 && one.length <= 94 && one.length !== 88) {
    const s1 = padMrzLine(one.slice(0, 30), 30);
    const s2 = padMrzLine(one.slice(30, 60), 30);
    const s3 = padMrzLine(one.slice(60), 30);
    return s1 + '\n' + s2 + '\n' + s3;
  }
  // TD3 (pasaport 2×44): 88 ideal; fotokopi/farklı ülkelerde OCR 80–96 dönebilir
  if (one.length >= 80 && one.length <= 96) {
    const s1 = padMrzLine(one.slice(0, 44), 44);
    const s2 = padMrzLine(one.slice(44, 88), 44);
    return s1 + '\n' + s2;
  }
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9<]/g, ''));
  const mrzLike = lines.filter((l) => l.length >= 26 && l.length <= 46);
  if (mrzLike.length >= 3 && mrzLike.every((l) => l.length >= 28 && l.length <= 32)) {
    return mrzLike.slice(0, 3).map((l) => padMrzLine(l, 30)).join('\n');
  }
  if (mrzLike.length >= 2 && mrzLike.every((l) => l.length >= 34 && l.length <= 38)) {
    return mrzLike.slice(0, 2).map((l) => padMrzLine(l, 36)).join('\n');
  }
  if (mrzLike.length >= 2 && mrzLike.every((l) => l.length >= 34 && l.length <= 46)) {
    return mrzLike.slice(0, 2).map((l) => padMrzLine(l, 44)).join('\n');
  }
  if (mrzLike.length >= 2) {
    const l0 = mrzLike[0].length, l1 = mrzLike[1].length;
    if (l0 >= 34 && l1 >= 34 && (l0 >= 38 || l1 >= 38)) return padMrzLine(mrzLike[0], 44) + '\n' + padMrzLine(mrzLike[1], 44);
    if (l0 >= 34 && l1 >= 34) return padMrzLine(mrzLike[0], 36) + '\n' + padMrzLine(mrzLike[1], 36);
    if (l0 >= 28 && l1 >= 28) return padMrzLine(mrzLike[0], 30) + '\n' + padMrzLine(mrzLike[1], 30);
  }
  if (mrzLike.length === 1 && mrzLike[0].length >= 30) return mrzLike[0];
  return '';
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

function normalizeMrzLines(raw) {
  const one = (raw || '').trim().toUpperCase().replace(/\s/g, '');
  // TD1 (kimlik): 3x30 — 86-94 karakter (88 dahil) önce kimlik olarak dene; pasaport 88 için TD3 aşağıda tryBoth için.
  if (one.length >= 86 && one.length <= 94 && /^[A-Z0-9<]+$/.test(one)) {
    const a = 30;
    const b = 60;
    return [one.slice(0, a).padEnd(30, '<'), one.slice(a, b).padEnd(30, '<'), one.slice(b).padEnd(30, '<')];
  }
  // TD3 (pasaport): 2x44 — 80-85 veya 95+ (tek blok olarak)
  if (one.length >= 80 && one.length <= 96 && /^[A-Z0-9<]+$/.test(one)) {
    const a = 44;
    return [one.slice(0, a).padEnd(44, '<'), one.slice(a).padEnd(44, '<')];
  }
  if (one.length >= 70 && one.length <= 74 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 36).padEnd(36, '<'), one.slice(36, 72).padEnd(36, '<')];
  }
  const lines = (raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.trim().toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9<]/g, '')).filter(Boolean);
  // TD1 (Türk kimlik): 3 satır — her biri 30 karaktere pad et
  if (lines.length >= 3 && (lines[0][0] === 'I' || lines[0][0] === 'A')) {
    const l1 = (lines[0] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN);
    const l2 = (lines[1] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN);
    const l3 = (lines[2] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN);
    if (l1.length >= 28 && l2.length >= 28 && l3.length >= 10) {
      return [l1, l2, l3];
    }
  }
  return lines;
}

/** Parse TD3 (passport) and return fields + checks. Satır 2 tam 44 karaktere kesilir; OCR fazla karakter okursa pozisyon kaymasın. */
function parseTD3(lines) {
  const l1 = (lines[0] || '').padEnd(TD3_LINE_LEN, '<').slice(0, TD3_LINE_LEN);
  const l2 = (lines[1] || '').slice(0, TD3_LINE_LEN).padEnd(TD3_LINE_LEN, '<');
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  const nameBlock = l1.substring(5, 44);
  const nameParts = nameBlock.split('<<').filter(Boolean);
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
  const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
  const documentNumber = l2.substring(0, 9).replace(/</g, '').trim();
  const passportNumberCheck = l2[9];
  const nationality = l2.substring(10, 13).replace(/</g, '').trim();
  const birthDateRaw = l2.substring(13, 19);
  const birthDateCheck = l2[19];
  const sex = l2[20];
  const expiryDateRaw = l2.substring(21, 27);
  const expiryDateCheck = l2[27];

  const passportNoCheck = passportNumberCheck === '<' || parseInt(passportNumberCheck, 10) === checkDigit(documentNumber);
  const birthCheck = birthDateCheck === '<' || parseInt(birthDateCheck, 10) === checkDigit(birthDateRaw);
  const expiryCheck = expiryDateCheck === '<' || parseInt(expiryDateCheck, 10) === checkDigit(expiryDateRaw);
  const compositeCheck = passportNoCheck && birthCheck && expiryCheck;

  return {
    fields: {
      documentNumber,
      nationality,
      surname,
      givenNames,
      birthDate: normalizeYYMMDD(birthDateRaw),
      sex: sex === 'M' || sex === 'F' ? sex : sex === '<' ? 'U' : 'X',
      expiryDate: normalizeYYMMDD(expiryDateRaw),
      issuingCountry,
      optionalData: l2.substring(28, 44).replace(/</g, '').trim() || undefined,
    },
    checks: { passportNoCheck, birthCheck, expiryCheck, compositeCheck },
  };
}

/** Parse TD2. */
function parseTD2(lines) {
  const l1 = (lines[0] || '').padEnd(TD2_LINE_LEN, '<');
  const l2 = (lines[1] || '').padEnd(TD2_LINE_LEN, '<');
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  const nameBlock = l1.substring(5, 36);
  const nameParts = nameBlock.split('<<').filter(Boolean);
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
  const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
  const documentNumber = l2.substring(0, 9).replace(/</g, '').trim();
  const passportNumberCheck = l2[9];
  const nationality = l2.substring(10, 13).replace(/</g, '').trim();
  const birthDateRaw = l2.substring(13, 19);
  const birthDateCheck = l2[19];
  const sex = l2[20];
  const expiryDateRaw = l2.substring(21, 27);
  const expiryDateCheck = l2[27];

  const passportNoCheck = passportNumberCheck === '<' || parseInt(passportNumberCheck, 10) === checkDigit(documentNumber);
  const birthCheck = birthDateCheck === '<' || parseInt(birthDateCheck, 10) === checkDigit(birthDateRaw);
  const expiryCheck = expiryDateCheck === '<' || parseInt(expiryDateCheck, 10) === checkDigit(expiryDateRaw);
  const compositeCheck = passportNoCheck && birthCheck && expiryCheck;

  return {
    fields: {
      documentNumber,
      nationality,
      surname,
      givenNames,
      birthDate: normalizeYYMMDD(birthDateRaw),
      sex: sex === 'M' || sex === 'F' ? sex : sex === '<' ? 'U' : 'X',
      expiryDate: normalizeYYMMDD(expiryDateRaw),
      issuingCountry,
      optionalData: l2.substring(28, 36).replace(/</g, '').trim() || undefined,
    },
    checks: { passportNoCheck, birthCheck, expiryCheck, compositeCheck },
  };
}

/** Parse TD1 (ID card). */
function parseTD1(lines) {
  const l1 = (lines[0] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN);
  const l2 = (lines[1] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN);
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  // Belge no 5-13 (9 kar), check 14. Türk kimlik bazen 10 karakter basar; BAC için ilk 9.
  let documentNumber = l1.substring(5, 14).replace(/</g, '').trim();
  if (documentNumber.length > 9) documentNumber = documentNumber.slice(0, 9);
  const docNumberCheck = l1[14];
  const birthDateRaw = l2.substring(0, 6);
  const birthDateCheck = l2[6];
  const sex = l2[7];
  const expiryDateRaw = l2.substring(8, 14);
  const expiryDateCheck = l2[14];
  const nationality = l2.substring(15, 18).replace(/</g, '').trim();
  const l3 = (lines[2] || '').padEnd(TD1_LINE_LEN, '<');
  // TD1 satır 2: optional data (18-29) — Türk kimlikte 11 haneli TC no
  const optionalData = l2.substring(18, 30).replace(/</g, '').trim();
  const personalNumber = /^\d{11}$/.test(optionalData) ? optionalData : undefined;
  // TD1 satır 3: SURNAME<<GIVENNAMES — Türk kimlik: ACAR<<HAKAN. OCR bazen tek < okur, split(/<+/) ile her iki durumda çalışır
  const nameParts = l3.split(/<+/).map((s) => s.trim()).filter(Boolean);
  const surname = (nameParts[0] || '').trim();
  const givenNames = (nameParts.slice(1).join(' ') || '').trim();

  const passportNoCheck = docNumberCheck === '<' || parseInt(docNumberCheck, 10) === checkDigit(documentNumber);
  const birthCheck = birthDateCheck === '<' || parseInt(birthDateCheck, 10) === checkDigit(birthDateRaw);
  const expiryCheck = expiryDateCheck === '<' || parseInt(expiryDateCheck, 10) === checkDigit(expiryDateRaw);
  const compositeCheck = passportNoCheck && birthCheck && expiryCheck;

  return {
    fields: {
      documentNumber,
      personalNumber,
      nationality,
      surname,
      givenNames,
      birthDate: normalizeYYMMDD(birthDateRaw),
      sex: sex === 'M' || sex === 'F' ? sex : sex === '<' ? 'U' : 'X',
      expiryDate: normalizeYYMMDD(expiryDateRaw),
      issuingCountry,
      optionalData: optionalData || undefined,
    },
    checks: { passportNoCheck, birthCheck, expiryCheck, compositeCheck },
  };
}

/** 86-94 karakter tek blok (88 hariç): TD1 (Türk kimlik 3x30) veya TD3 (pasaport 2x44). docTypeHint 'id' ise TD1 öncelikli. */
function parseMrzRawAmbiguous(one, opts = {}) {
  if (!one || one.length < 86 || one.length > 94 || one.length === 88) return null;
  const preferIdCard = opts.docTypeHint === 'id';
  const asTd1 = [
    one.slice(0, 30).padEnd(30, '<'),
    one.slice(30, 60).padEnd(30, '<'),
    one.slice(60).padEnd(30, '<'),
  ];
  const asTd3 = [one.slice(0, 44).padEnd(44, '<'), one.slice(44).padEnd(44, '<')];
  const p1 = parseTD1(asTd1);
  const p3 = parseTD3(asTd3);
  if (preferIdCard && p1) return p1;
  if (p1 && p1.checks && p1.checks.compositeCheck) return p1;
  if (p3 && p3.checks && p3.checks.compositeCheck) return p3;
  if (p1) return p1;
  if (p3) return p3;
  return null;
}

/**
 * Parse MRZ raw string into fields + checks.
 * @param {string} mrzRaw
 * @param {{ docTypeHint?: string }} [opts] - docTypeHint 'id' → Türk kimlik (TD1) öncelikli
 * @returns {{ fields: object, checks: { passportNoCheck, birthCheck, expiryCheck, compositeCheck } } | null}
 */
/** DEBUG_MRZ: Railway/ortamda DEBUG_MRZ=true veya 1 ise OCR/metin ve parse adımları loglanır. */
const DEBUG_MRZ = process.env.DEBUG_MRZ === 'true' || process.env.DEBUG_MRZ === '1';

function parseMrzRaw(mrzRaw, opts = {}) {
  if (!mrzRaw || typeof mrzRaw !== 'string') return null;
  const cleaned = (mrzRaw || '').replace(/[^A-Z0-9<\r\n]/gi, '').trim().toUpperCase();
  const one = cleaned.replace(/\s/g, '');
  if (DEBUG_MRZ) {
    console.log('[MRZ] parseMrzRaw giriş uzunluk:', mrzRaw.length, 'temizlenmiş:', one.length, 'ilk 60:', one.slice(0, 60));
  }
  if (one.length >= 86 && one.length <= 94 && one.length !== 88 && /^[A-Z0-9<]+$/.test(one)) {
    const ambiguous = parseMrzRawAmbiguous(one, opts);
    if (ambiguous) return ambiguous;
  }
  const lines = normalizeMrzLines(cleaned);
  if (DEBUG_MRZ || (process.env.DEBUG_MRZ !== '0' && lines.length >= 1)) {
    console.log('[MRZ] Satır sayısı:', lines.length, '1. satır uzunluk:', lines[0]?.length, '2.:', lines[1]?.length, '3.:', lines[2]?.length);
  }
  // TD1 (Türk kimlik) önce — 3 satır
  if (lines.length >= 3 && (lines[0][0] === 'I' || lines[0][0] === 'A') && lines[0].length >= 28) {
    const td1Lines = [
      (lines[0] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN),
      (lines[1] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN),
      (lines[2] || '').padEnd(TD1_LINE_LEN, '<').slice(0, TD1_LINE_LEN),
    ];
    return parseTD1(td1Lines);
  }
  const preferId = opts.docTypeHint === 'id';
  if (preferId && lines.length >= 3 && lines[0].length >= 28) return parseTD1(lines);
  if (lines.length >= 2 && lines[0].length >= 38) return parseTD3(lines);
  if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) return parseTD2(lines);
  if (lines.length >= 3 && lines[0].length >= 28) return parseTD1(lines);
  return null;
}

/**
 * Compute confidence 0..100 from checks.
 * Full pass -> 95-100, one fail -> 85-94, format/length issues -> <70.
 */
function confidenceFromChecks(parsed) {
  if (!parsed || !parsed.checks) return 0;
  const { compositeCheck } = parsed.checks;
  if (compositeCheck) return 97;
  const { passportNoCheck, birthCheck, expiryCheck } = parsed.checks;
  const passCount = [passportNoCheck, birthCheck, expiryCheck].filter(Boolean).length;
  if (passCount >= 2) return 88;
  if (passCount >= 1) return 75;
  return 60;
}

const TESSERACT_MRZ_OPTIONS = {
  logger: () => {},
  tessedit_pageseg_mode: 6,
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
};

function runOcr(imagePath) {
  return Tesseract.recognize(imagePath, 'eng', TESSERACT_MRZ_OPTIONS).then((r) => r.data.text);
}

/** Buffer üzerinde OCR (çoklu deneme için). */
function runOcrOnBuffer(imageBuffer) {
  return Tesseract.recognize(imageBuffer, 'eng', TESSERACT_MRZ_OPTIONS).then((r) => r.data.text);
}

/**
 * OCR metninin MRZ'ye ne kadar benzediğini puanla (2/3 satır, P/I ile başlama, uzunluk, < sayısı, rakam/harf).
 * @param {string} text
 * @returns {number}
 */
function calculateMrzScore(text) {
  if (!text || typeof text !== 'string') return 0;
  let score = 0;
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().replace(/\s/g, '')).filter((l) => l.length > 20);
  if (lines.length === 2 || lines.length === 3) score += 20;
  if (lines[0] && /^[PI]/.test(lines[0])) score += 10;
  lines.forEach((line) => {
    if (line.length >= 30) score += 5;
    if (line.length >= 44) score += 5;
    const fillerCount = (line.match(/</g) || []).length;
    if (fillerCount > 5) score += 5;
  });
  const digitCount = (text.match(/[0-9]/g) || []).length;
  const letterCount = (text.match(/[A-Z]/g) || []).length;
  if (digitCount > 10) score += 10;
  if (letterCount > 10) score += 10;
  const parsed = parseMrzRaw(text);
  if (parsed && parsed.checks && parsed.checks.compositeCheck) score += 20;
  return score;
}

/**
 * Belge formatı algıla: TD1 (3x30), TD2 (2x36), TD3 (2x44).
 * @param {string} text - MRZ ham metin (satırlar \n ile)
 * @returns {{ format: string, type: string }}
 */
function detectDocumentFormat(text) {
  if (!text || typeof text !== 'string') return { format: 'UNKNOWN', type: 'UNKNOWN' };
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim().replace(/\s/g, '')).filter((l) => l.length > 10);
  if (lines.length === 3 && lines[0].length === 30) return { format: 'TD1', type: 'ID_CARD' };
  if (lines.length === 2 && lines[0].length === 36) return { format: 'TD2', type: 'DRIVING_LICENSE' };
  if (lines.length === 2 && lines[0].length === 44) return { format: 'TD3', type: 'PASSPORT' };
  if (lines.length === 3 && lines[0].length >= 28 && lines[0].length <= 30) return { format: 'TD1', type: 'ID_CARD' };
  if (lines.length === 2 && lines[0].length >= 34 && lines[0].length <= 46) return { format: 'TD3', type: 'PASSPORT' };
  return { format: 'UNKNOWN', type: 'UNKNOWN' };
}

/**
 * Parse sonucunda check digit doğrulaması geçti mi?
 * @param {{ checks?: { compositeCheck?: boolean } } | null} parsed
 * @returns {boolean}
 */
function validateCheckDigits(parsed) {
  return !!(parsed && parsed.checks && parsed.checks.compositeCheck);
}

/**
 * Evrensel MRZ okuma: 5 farklı ön işleme stratejisi dene, en iyi skorlu sonucu döndür.
 * Kağıt/fotokopi/ekran/yıpranmış belge için.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ text: string, confidence: number, score: number, format: object, attemptName?: string } | null>}
 */
async function universalMrzRead(imageBuffer) {
  const { UniversalPreprocessor } = require('./universalPreprocess');
  const Jimp = (await import('jimp')).default;
  const preprocessor = new UniversalPreprocessor();
  const strategies = [
    { type: 'original', name: 'Orijinal' },
    { type: 'highContrast', name: 'Yüksek kontrast' },
    { type: 'inverted', name: 'Negatif' },
    { type: 'sharpened', name: 'Keskin' },
    { type: 'denoised', name: 'Gürültü azaltılmış' },
  ];
  let bestResult = null;
  let bestScore = 0;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const processed = await preprocessor.preprocessVariant(imageBuffer, i);
      const buf = await processed.getBufferAsync(Jimp.MIME_JPEG);
      const ocrText = await runOcrOnBuffer(buf);
      const raw = extractMrzFromOcr(ocrText);
      if (!raw) continue;
      const parsed = parseMrzRaw(raw);
      let score = calculateMrzScore(raw);
      if (parsed && validateCheckDigits(parsed)) score += 20;
      if (score > bestScore) {
        bestScore = score;
        bestResult = {
          text: raw,
          confidence: parsed && validateCheckDigits(parsed) ? 97 : Math.min(90, 50 + score),
          score,
          format: detectDocumentFormat(raw),
          attemptName: strategies[i].name,
        };
      }
    } catch (_) {}
  }
  return bestResult;
}

/**
 * Kağıt/fotokopi/düşük kalite için çoklu ön işleme dene, en iyi skorlu MRZ metnini döndür.
 * @param {Buffer} imageBuffer
 * @returns {Promise<{ text: string, confidence: number, attemptName?: string } | null>}
 */
async function extractMrzWithMultipleAttempts(imageBuffer) {
  const { preprocessForMRZ } = require('./preprocess');
  const Jimp = (await import('jimp')).default;
  const attempts = [];

  try {
    const processed1 = await preprocessForMRZ(imageBuffer);
    const buf1 = await processed1.getBufferAsync(Jimp.MIME_JPEG);
    attempts.push({ name: 'Normal kontrast', getBuffer: () => Promise.resolve(buf1) });
  } catch (_) {}

  try {
    const image = await Jimp.read(imageBuffer);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const mrzH = Math.floor(h * 0.4);
    const y = Math.max(0, h - mrzH);
    const highContrast = image.clone().crop(0, y, w, mrzH).greyscale().normalize().contrast(0.8);
    const buf2 = await highContrast.getBufferAsync(Jimp.MIME_JPEG);
    attempts.push({ name: 'Yüksek kontrast', getBuffer: () => Promise.resolve(buf2) });
  } catch (_) {}

  try {
    const image = await Jimp.read(imageBuffer);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const mrzH = Math.floor(h * 0.4);
    const y = Math.max(0, h - mrzH);
    const negative = image.clone().crop(0, y, w, mrzH).greyscale().normalize().contrast(0.5).invert();
    const buf3 = await negative.getBufferAsync(Jimp.MIME_JPEG);
    attempts.push({ name: 'Negatif', getBuffer: () => Promise.resolve(buf3) });
  } catch (_) {}

  try {
    const image = await Jimp.read(imageBuffer);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const mrzH = Math.floor(h * 0.4);
    const y = Math.max(0, h - mrzH);
    const sharp = image.clone().crop(0, y, w, mrzH).greyscale().normalize().contrast(0.4).convolute([
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ]);
    const buf4 = await sharp.getBufferAsync(Jimp.MIME_JPEG);
    attempts.push({ name: 'Keskin', getBuffer: () => Promise.resolve(buf4) });
  } catch (_) {}

  let bestResult = null;
  let bestScore = 0;
  for (const attempt of attempts) {
    try {
      const buf = await attempt.getBuffer();
      const text = await runOcrOnBuffer(buf);
      const raw = extractMrzFromOcr(text);
      if (!raw) continue;
      const score = calculateMrzScore(raw);
      const parsed = parseMrzRaw(raw);
      if (parsed && parsed.checks && parsed.checks.compositeCheck) {
        return { text: raw, confidence: 97, attemptName: attempt.name };
      }
      if (score > bestScore) {
        bestScore = score;
        bestResult = { text: raw, confidence: Math.min(90, 50 + score), attemptName: attempt.name };
      }
    } catch (_) {}
  }
  return bestResult;
}

/**
 * Görüntüyü yatay 3 dilime bölüp her dilimde MRZ ara (iki pasaport yan yana vb.).
 * @param {Buffer} imageBuffer
 * @returns {Promise<Array<{ position: number, text: string, confidence: number }>>}
 */
async function extractMultipleMRZ(imageBuffer) {
  const Jimp = (await import('jimp')).default;
  const image = await Jimp.read(imageBuffer);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const sliceHeight = Math.floor(h / 3);
  const mrzList = [];
  for (let i = 0; i < 3; i++) {
    const yStart = i * sliceHeight;
    const slice = image.clone().crop(0, yStart, w, sliceHeight);
    const buf = await slice.getBufferAsync(Jimp.MIME_JPEG);
    const result = await extractMrzWithMultipleAttempts(buf);
    if (result && result.text && result.text.length > 50) {
      mrzList.push({
        position: i,
        text: result.text,
        confidence: result.confidence || 0,
      });
    }
  }
  return mrzList;
}

/**
 * Run MRZ pipeline: preprocessed image path -> OCR -> extract -> parse -> result.
 * Tesseract PSM 6 + MRZ whitelist for speed and accuracy. On failure, paper mode retries with stronger preprocessing.
 * @param {string} imagePath - Preprocessed image path
 * @param {string} correlationId - For logging
 * @param {{ paperMode?: boolean, docTypeHint?: string }} [opts] - paperMode: kağıt ön işlemi; docTypeHint: 'id' = TC kimlik (TD1) öncelikli
 * @returns {Promise<{ ok: boolean, confidence: number, mrzRaw: string, mrzRawMasked: string, fields: object, checks: object, errorCode?: string }>}
 */
async function runMrzPipeline(imagePath, correlationId, opts = {}) {
  const { logScanEvent } = require('../log/scanLog');
  const { maskMrz } = require('../security/redact');
  const { preprocessForPaperMrz, preprocessMrzImage, preprocessForTurkishIdMrz } = require('./preprocess');

  logScanEvent(correlationId, 'preprocess_done', {});
  let text;
  try {
    text = await runOcr(imagePath);
  } catch (e) {
    logScanEvent(correlationId, 'error', { errorCode: 'ocr_failed', message: e.message });
    return { ok: false, confidence: 0, mrzRaw: '', mrzRawMasked: maskMrz(''), fields: {}, checks: {}, errorCode: 'ocr_failed' };
  }
  logScanEvent(correlationId, 'ocr_done', {});
  if (DEBUG_MRZ) {
    console.log('[MRZ] OCR metin uzunluk:', (text || '').length, 'ilk 200:', (text || '').trim().slice(0, 200));
  }
  let mrzRaw = extractMrzFromOcr(text);
  if (DEBUG_MRZ) {
    console.log('[MRZ] extractMrzFromOcr sonucu:', mrzRaw ? `${mrzRaw.length} karakter` : 'boş', mrzRaw ? 'ilk satır: ' + mrzRaw.split('\n')[0]?.slice(0, 44) : '');
  }
  if (!mrzRaw && opts.paperMode && fs.existsSync(imagePath)) {
    const dir = path.dirname(imagePath);
    if (opts.docTypeHint === 'id') {
      const turkishPath = path.join(dir, `scan_turkish_id_${Date.now()}.jpg`);
      try {
        fs.copyFileSync(imagePath, turkishPath);
        await preprocessForTurkishIdMrz(turkishPath);
        const textId = await runOcr(turkishPath);
        mrzRaw = extractMrzFromOcr(textId);
        if (DEBUG_MRZ && textId) console.log('[MRZ] Türk kimlik ön işleme OCR uzunluk:', textId.length);
        try { fs.unlinkSync(turkishPath); } catch (_) {}
      } catch (_) {
        try { fs.unlinkSync(turkishPath); } catch (__) {}
      }
    }
    if (!mrzRaw) {
      const paperPath = path.join(dir, `scan_paper_${Date.now()}.jpg`);
      try {
        fs.copyFileSync(imagePath, paperPath);
        await preprocessForPaperMrz(paperPath);
        const text2 = await runOcr(paperPath);
        mrzRaw = extractMrzFromOcr(text2);
        try { fs.unlinkSync(paperPath); } catch (_) {}
      } catch (_) {
        try { fs.unlinkSync(paperPath); } catch (__) {}
      }
    }
    if (!mrzRaw) {
      const cropPath = path.join(dir, `scan_crop_${Date.now()}.jpg`);
      try {
        fs.copyFileSync(imagePath, cropPath);
        await preprocessMrzImage(cropPath, { mrzFraction: 0.35, contrast: 0.4, brightness: 0.1 });
        const text3 = await runOcr(cropPath);
        mrzRaw = extractMrzFromOcr(text3);
        try { fs.unlinkSync(cropPath); } catch (_) {}
      } catch (_) {
        try { fs.unlinkSync(cropPath); } catch (__) {}
      }
    }
  }

  if (!mrzRaw) {
    if (DEBUG_MRZ) console.log('[MRZ] mrz_not_found – OCR çıktısından MRZ çıkarılamadı');
    logScanEvent(correlationId, 'parse_done', { found: false });
    return { ok: false, confidence: 0, mrzRaw: '', mrzRawMasked: '', fields: {}, checks: {}, errorCode: 'mrz_not_found' };
  }

  const parseOpts = opts.docTypeHint ? { docTypeHint: opts.docTypeHint } : {};
  const parsed = parseMrzRaw(mrzRaw, parseOpts);
  if (!parsed) {
    if (DEBUG_MRZ) console.log('[MRZ] invalid_format – mrzRaw:', mrzRaw.slice(0, 120));
    logScanEvent(correlationId, 'parse_done', { found: true, validFormat: false });
    return { ok: false, confidence: 0, mrzRaw, mrzRawMasked: maskMrz(mrzRaw), fields: {}, checks: {}, errorCode: 'invalid_format' };
  }

  const confidence = confidenceFromChecks(parsed);
  logScanEvent(correlationId, 'parse_done', { found: true, validFormat: true, confidence });

  return {
    ok: true,
    confidence,
    mrzRaw,
    mrzRawMasked: maskMrz(mrzRaw),
    fields: parsed.fields,
    checks: parsed.checks,
  };
}

module.exports = {
  extractMrzFromOcr,
  parseMrzRaw,
  confidenceFromChecks,
  runMrzPipeline,
  runOcrOnBuffer,
  calculateMrzScore,
  detectDocumentFormat,
  validateCheckDigits,
  universalMrzRead,
  extractMrzWithMultipleAttempts,
  extractMultipleMRZ,
  checkDigit,
  normalizeMrzLines,
};
