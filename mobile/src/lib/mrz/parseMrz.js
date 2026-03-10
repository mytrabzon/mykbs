/**
 * MRZ ham string parse - TD3 (pasaport), TD2 (ehliyet/ikamet), TD1 (kimlik). Check digit: ICAO 9303.
 */

const TD3_LINE_LEN = 44;
const TD2_LINE_LEN = 36;
const TD1_LINE_LEN = 30;

function checkDigit(s) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    let v = c === '<' ? 0 : (c >= '0' && c <= '9') ? parseInt(c, 10) : (c >= 'A' && c <= 'Z') ? c.charCodeAt(0) - 55 : 0;
    sum += v * weights[i % 3];
  }
  return sum % 10;
}

function normalizeYYMMDD(yymmdd) {
  if (!yymmdd || yymmdd.length < 6) return '';
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);
  const year = yy <= 30 ? 2000 + yy : 1900 + yy;
  return year + '-' + mm + '-' + dd;
}

function parseTD3(lines) {
  const l1 = (lines[0] || '').padEnd(TD3_LINE_LEN, '<');
  const l2 = (lines[1] || '').padEnd(TD3_LINE_LEN, '<');
  const docType = l1[0] === 'P' ? 'P' : 'OTHER';
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  const nameBlock = l1.substring(5, 44);
  const nameParts = nameBlock.split('<<').filter(Boolean);
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
  const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
  const passportNumber = l2.substring(0, 9).replace(/</g, '').trim();
  const passportNumberCheck = l2[9];
  const nationality = l2.substring(10, 13).replace(/</g, '').trim();
  const birthDateRaw = l2.substring(13, 19);
  const birthDateCheck = l2[19];
  const sex = l2[20];
  const expiryDateRaw = l2.substring(21, 27);
  const expiryDateCheck = l2[27];
  const docNoCheckOk = passportNumberCheck === '<' || parseInt(passportNumberCheck, 10) === checkDigit(passportNumber);
  const birthCheckOk = birthDateCheck === '<' || parseInt(birthDateCheck, 10) === checkDigit(birthDateRaw);
  const expiryCheckOk = expiryDateCheck === '<' || parseInt(expiryDateCheck, 10) === checkDigit(expiryDateRaw);
  const checksOk = docNoCheckOk && birthCheckOk && expiryCheckOk;
  let reason = !docNoCheckOk ? 'document_number_check' : !birthCheckOk ? 'birth_date_check' : !expiryCheckOk ? 'expiry_date_check' : '';
  return {
    docType,
    issuingCountry,
    surname,
    givenNames,
    passportNumber,
    nationality,
    birthDate: normalizeYYMMDD(birthDateRaw),
    sex: sex === 'M' || sex === 'F' ? sex : sex === '<' ? 'U' : 'X',
    expiryDate: normalizeYYMMDD(expiryDateRaw),
    raw: lines.join('\n'),
    checks: { ok: checksOk, reason: reason || undefined },
  };
}

function parseTD2(lines) {
  const l1 = (lines[0] || '').padEnd(TD2_LINE_LEN, '<');
  const l2 = (lines[1] || '').padEnd(TD2_LINE_LEN, '<');
  const docType = l1[0] === 'P' ? 'P' : (l1[0] === 'I' || l1[0] === 'A' ? 'ID' : 'OTHER');
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  const nameBlock = l1.substring(5, 36);
  const nameParts = nameBlock.split('<<').filter(Boolean);
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
  const givenNames = (nameParts[1] || '').replace(/</g, ' ').trim();
  const passportNumber = l2.substring(0, 9).replace(/</g, '').trim();
  const passportNumberCheck = l2[9];
  const nationality = l2.substring(10, 13).replace(/</g, '').trim();
  const birthDateRaw = l2.substring(13, 19);
  const birthDateCheck = l2[19];
  const sex = l2[20];
  const expiryDateRaw = l2.substring(21, 27);
  const expiryDateCheck = l2[27];
  const docNoCheckOk = passportNumberCheck === '<' || parseInt(passportNumberCheck, 10) === checkDigit(passportNumber);
  const birthCheckOk = birthDateCheck === '<' || parseInt(birthDateCheck, 10) === checkDigit(birthDateRaw);
  const expiryCheckOk = expiryDateCheck === '<' || parseInt(expiryDateCheck, 10) === checkDigit(expiryDateRaw);
  const checksOk = docNoCheckOk && birthCheckOk && expiryCheckOk;
  let reason = !docNoCheckOk ? 'document_number_check' : !birthCheckOk ? 'birth_date_check' : !expiryCheckOk ? 'expiry_date_check' : '';
  return {
    docType,
    issuingCountry,
    surname,
    givenNames,
    passportNumber,
    nationality,
    birthDate: normalizeYYMMDD(birthDateRaw),
    sex: sex === 'M' || sex === 'F' ? sex : sex === '<' ? 'U' : 'X',
    expiryDate: normalizeYYMMDD(expiryDateRaw),
    raw: lines.join('\n'),
    checks: { ok: checksOk, reason: reason || undefined },
  };
}

function parseTD1(lines) {
  const l1 = (lines[0] || '').padEnd(TD1_LINE_LEN, '<');
  const l2 = (lines[1] || '').padEnd(TD1_LINE_LEN, '<');
  const l3 = (lines[2] || '').padEnd(TD1_LINE_LEN, '<');
  const docType = l1[0] === 'I' || l1[0] === 'A' ? 'ID' : 'OTHER';
  const issuingCountry = l1.substring(2, 5).replace(/</g, '').trim();
  const docNumber = l1.substring(5, 14).replace(/</g, '').trim();
  const docNumberCheck = l1[14];
  const birthDateRaw = l2.substring(0, 6);
  const birthDateCheck = l2[6];
  const sex = l2[7];
  const expiryDateRaw = l2.substring(8, 14);
  const expiryDateCheck = l2[14];
  const nationality = l2.substring(15, 18).replace(/</g, '').trim();
  // TD1 satır 3: SURNAME<<GIVENNAMES — OCR bazen tek < okur, split(/<+/) ile her iki durumda çalışır
  const nameParts = l3.split(/<+/).map((s) => s.trim()).filter(Boolean);
  const surname = (nameParts[0] || '').trim();
  const givenNames = (nameParts.slice(1).join(' ') || '').trim();
  const docNoCheckOk = docNumberCheck === '<' || parseInt(docNumberCheck, 10) === checkDigit(docNumber);
  const birthCheckOk = birthDateCheck === '<' || parseInt(birthDateCheck, 10) === checkDigit(birthDateRaw);
  const expiryCheckOk = expiryDateCheck === '<' || parseInt(expiryDateCheck, 10) === checkDigit(expiryDateRaw);
  const checksOk = docNoCheckOk && birthCheckOk && expiryCheckOk;
  let reason = !docNoCheckOk ? 'document_number_check' : !birthCheckOk ? 'birth_date_check' : !expiryCheckOk ? 'expiry_date_check' : '';
  return {
    docType,
    issuingCountry,
    surname,
    givenNames,
    passportNumber: docNumber,
    nationality,
    birthDate: normalizeYYMMDD(birthDateRaw),
    sex: sex === 'M' || sex === 'F' ? sex : sex === '<' ? 'U' : 'X',
    expiryDate: normalizeYYMMDD(expiryDateRaw),
    raw: lines.join('\n'),
    checks: { ok: checksOk, reason: reason || undefined },
  };
}

/** Tarih alanlarında (YYMMDD) soluk/fotokopi OCR karışıklıkları. */
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
/** Belge no / check digit – sadece yaygın karışıklıklar. */
const OCR_DIGIT_SAFE = { O: '0', Q: '0', I: '1', L: '1', '|': '1', S: '5', B: '8', Z: '2' };
function fixLineDigitPositions(line, digitRanges) {
  if (!line) return line;
  const arr = line.split('');
  for (const [start, end] of digitRanges) {
    const isDateRange = start >= 13 && end <= 29;
    const map = isDateRange ? OCR_DATE_FIXES : OCR_DIGIT_SAFE;
    for (let i = start; i < end && i < arr.length; i++) {
      const c = arr[i];
      const fix = map[c];
      if (fix) arr[i] = fix;
    }
  }
  return arr.join('');
}

export function fixMrzOcrErrors(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const lines = normalizeMrzLines(raw);
  if (lines.length >= 2 && lines[0].length >= 30) {
    // TD3 pasaport: 2. satır doc 0-9, birth 13-19, expiry 21-27 (aynı kağıttaki farklı MRZ için)
    lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
  }
  if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) {
    lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
  } else if (lines.length >= 3 && lines[0].length >= 28) {
    // TD1: line1 doc 5-15, line2 birth 0-7, expiry 8-15
    lines[0] = fixLineDigitPositions(lines[0], [[5, 15]]);
    lines[1] = fixLineDigitPositions(lines[1], [[0, 8], [8, 15]]);
  }
  return lines.join('\n');
}

/** Ham MRZ'ı satırlara böl. TD1 kimlik: 3x30 (86-94 karakter tek blok); TD3 pasaport: 2x44 (88); TD2: 2x36 (72). */
function normalizeMrzLines(raw) {
  const one = raw.trim().toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9<]/g, '');
  // Kimlik (TD1): 3 satır — 88 karakter (30+30+28) I/A ile başlarsa kimlik; 88 ve P ise pasaport aşağıda
  const isIdCard = one[0] === 'I' || one[0] === 'A';
  if (one.length >= 86 && one.length <= 94 && (one.length !== 88 || isIdCard)) {
    const s1 = one.slice(0, 30).padEnd(30, '<');
    const s2 = one.slice(30, 60).padEnd(30, '<');
    const s3 = one.slice(60).padEnd(30, '<');
    return [s1, s2, s3];
  }
  // Pasaport (TD3): 2×44 — 66–100 karakter (88 ve P ile başlarsa veya 88 değilse)
  if (one.length >= 66 && one.length <= 100) {
    const s1 = one.slice(0, 44).padEnd(44, '<');
    const s2 = one.slice(44).padEnd(44, '<');
    return [s1, s2];
  }
  if (one.length >= 68 && one.length <= 76) {
    return [one.slice(0, 36).padEnd(36, '<'), one.slice(36, 72).padEnd(36, '<')];
  }
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    .map((l) => l.trim().toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9<]/g, '')).filter(Boolean);
  if (lines.length >= 2 && lines[0].length >= 28 && lines[1].length >= 28) {
    const total = lines[0].length + lines[1].length;
    if (total >= 72 && total <= 76 && lines[0].length >= 34 && lines[0].length <= 36) {
      return [lines[0].padEnd(36, '<').slice(0, 36), lines[1].padEnd(36, '<').slice(0, 36)];
    }
    if (total >= 68 && total <= 100) {
      return [lines[0].padEnd(44, '<').slice(0, 44), lines[1].padEnd(44, '<').slice(0, 44)];
    }
  }
  return lines;
}

function parseMrzWithLines(lines) {
  if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) return parseTD2(lines);
  // TD3 pasaport: 28+ satır uzunluğu (İran vb. farklı font/uzunluk)
  if (lines.length >= 2 && lines[0].length >= 28) return parseTD3(lines);
  if (lines.length >= 3 && lines[0].length >= 28) return parseTD1(lines);
  return null;
}

export function parseMrz(raw) {
  if (!raw || typeof raw !== 'string') {
    return { docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw: '', checks: { ok: false, reason: 'empty_input' } };
  }
  const lines = normalizeMrzLines(raw);
  let result = parseMrzWithLines(lines);
  if (result) return result;
  const one = raw.trim().toUpperCase().replace(/\s/g, '').replace(/[^A-Z0-9<]/g, '');
  // İran vb. pasaportlar: farklı bölme noktaları dene (tek satır 66–100 karakter)
  if (one.length >= 66 && one.length <= 100) {
    for (const splitAt of [44, 43, 45, 42, 46, 41, 40]) {
      if (splitAt >= one.length) continue;
      const l1 = one.slice(0, splitAt).padEnd(44, '<');
      const l2 = one.slice(splitAt).padEnd(44, '<');
      result = parseMrzWithLines([l1, l2]);
      if (result && result.passportNumber) return result;
    }
  }
  return { docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw, checks: { ok: false, reason: 'invalid_format' } };
}

// fixMrzOcrErrors yalnızca "export function" ile dışa aktarılır; burada tekrarlanmamalı (duplicate export hatası).
export { checkDigit, normalizeYYMMDD };
