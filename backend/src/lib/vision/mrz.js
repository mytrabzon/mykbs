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

/** Extract MRZ-like lines from OCR text (TD1 3x30, TD2 2x36, TD3 2x44). */
function extractMrzFromOcr(text) {
  if (!text || typeof text !== 'string') return '';
  const one = text.replace(/\s/g, '').trim().toUpperCase();
  if (/^[A-Z0-9<]+$/.test(one) && one.length >= 88 && one.length <= 92) {
    const s1 = padMrzLine(one.slice(0, 44), 44);
    const s2 = padMrzLine(one.slice(44, 88), 44);
    return s1 + '\n' + s2;
  }
  if (/^[A-Z0-9<]+$/.test(one) && one.length >= 70 && one.length <= 74) {
    const s1 = padMrzLine(one.slice(0, 36), 36);
    const s2 = padMrzLine(one.slice(36, 72), 36);
    return s1 + '\n' + s2;
  }
  if (/^[A-Z0-9<]+$/.test(one) && one.length >= 89 && one.length <= 91) {
    const s1 = padMrzLine(one.slice(0, 30), 30);
    const s2 = padMrzLine(one.slice(30, 60), 30);
    const s3 = padMrzLine(one.slice(60, 90), 30);
    return s1 + '\n' + s2 + '\n' + s3;
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

function normalizeYYMMDD(yymmdd) {
  if (!yymmdd || yymmdd.length < 6) return '';
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  return year + '-' + mm + '-' + dd;
}

function normalizeMrzLines(raw) {
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

/** Parse TD3 (passport) and return fields + checks. */
function parseTD3(lines) {
  const l1 = (lines[0] || '').padEnd(TD3_LINE_LEN, '<');
  const l2 = (lines[1] || '').padEnd(TD3_LINE_LEN, '<');
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
  const l1 = (lines[0] || '').padEnd(TD1_LINE_LEN, '<');
  const l2 = (lines[1] || '').padEnd(TD1_LINE_LEN, '<');
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  const documentNumber = l1.substring(5, 14).replace(/</g, '').trim();
  const docNumberCheck = l1[14];
  const birthDateRaw = l2.substring(0, 6);
  const birthDateCheck = l2[6];
  const sex = l2[7];
  const expiryDateRaw = l2.substring(8, 14);
  const expiryDateCheck = l2[14];
  const nationality = l2.substring(15, 18).replace(/</g, '').trim();
  const l3 = (lines[2] || '').padEnd(TD1_LINE_LEN, '<');
  const nameBlock = l3.replace(/</g, ' ').trim();
  const nameParts = nameBlock.split(/\s{2,}/).filter(Boolean);
  const surname = (nameParts[0] || '').trim();
  const givenNames = (nameParts.slice(1).join(' ') || '').trim();

  const passportNoCheck = docNumberCheck === '<' || parseInt(docNumberCheck, 10) === checkDigit(documentNumber);
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
      optionalData: undefined,
    },
    checks: { passportNoCheck, birthCheck, expiryCheck, compositeCheck },
  };
}

/**
 * Parse MRZ raw string into fields + checks.
 * @returns {{ fields: object, checks: { passportNoCheck, birthCheck, expiryCheck, compositeCheck } } | null}
 */
function parseMrzRaw(mrzRaw) {
  if (!mrzRaw || typeof mrzRaw !== 'string') return null;
  const lines = normalizeMrzLines(mrzRaw);
  if (lines.length >= 2 && lines[0].length >= 40) return parseTD3(lines);
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

/**
 * Run MRZ pipeline: preprocessed image path -> OCR -> extract -> parse -> result.
 * @param {string} imagePath - Preprocessed image path
 * @param {string} correlationId - For logging
 * @returns {Promise<{ ok: boolean, confidence: number, mrzRaw: string, mrzRawMasked: string, fields: object, checks: object, errorCode?: string }>}
 */
async function runMrzPipeline(imagePath, correlationId) {
  const { logScanEvent } = require('../log/scanLog');
  const { maskMrz } = require('../security/redact');

  logScanEvent(correlationId, 'preprocess_done', {});
  let text;
  try {
    const { data: { text: t } } = await Tesseract.recognize(imagePath, 'tur+eng', { logger: () => {} });
    text = t;
  } catch (e) {
    logScanEvent(correlationId, 'error', { errorCode: 'ocr_failed', message: e.message });
    return { ok: false, confidence: 0, mrzRaw: '', mrzRawMasked: maskMrz(''), fields: {}, checks: {}, errorCode: 'ocr_failed' };
  }
  logScanEvent(correlationId, 'ocr_done', {});

  const mrzRaw = extractMrzFromOcr(text);
  if (!mrzRaw) {
    logScanEvent(correlationId, 'parse_done', { found: false });
    return { ok: false, confidence: 0, mrzRaw: '', mrzRawMasked: '', fields: {}, checks: {}, errorCode: 'mrz_not_found' };
  }

  const parsed = parseMrzRaw(mrzRaw);
  if (!parsed) {
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
};
