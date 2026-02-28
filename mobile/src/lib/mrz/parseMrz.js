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
  const nameBlock = l3.replace(/</g, ' ').trim();
  const nameParts = nameBlock.split(/\s{2,}/).filter(Boolean);
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

/** MRZ satırında sadece rakam/check olması gereken pozisyonlarda OCR düzeltmesi (O->0, I/L->1). */
function fixLineDigitPositions(line, digitRanges) {
  const arr = line.split('');
  for (const [start, end] of digitRanges) {
    for (let i = start; i < end && i < arr.length; i++) {
      const c = arr[i];
      if (c === 'O' || c === 'Q') arr[i] = '0';
      else if (c === 'I' || c === 'L' || c === '|') arr[i] = '1';
    }
  }
  return arr.join('');
}

export function fixMrzOcrErrors(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const lines = normalizeMrzLines(raw);
  if (lines.length >= 2 && lines[0].length >= 40) {
    // TD3: line2 doc 0-9, birth 13-19, expiry 21-27
    lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
  } else if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) {
    lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
  } else if (lines.length >= 3 && lines[0].length >= 28) {
    // TD1: line1 doc 5-15, line2 birth 0-7, expiry 8-15
    lines[0] = fixLineDigitPositions(lines[0], [[5, 15]]);
    lines[1] = fixLineDigitPositions(lines[1], [[0, 8], [8, 15]]);
  }
  return lines.join('\n');
}

/** Ham MRZ'ı satırlara böl; tek satırda birleşik gelen TD1 (90) / TD2 (72) / TD3 (88) formatını ayır */
function normalizeMrzLines(raw) {
  const one = raw.trim().toUpperCase().replace(/\s/g, '');
  if (one.length === 90 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 30), one.slice(30, 60), one.slice(60, 90)];
  }
  if (one.length === 88 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 44), one.slice(44, 88)];
  }
  if (one.length === 72 && /^[A-Z0-9<]+$/.test(one)) {
    return [one.slice(0, 36), one.slice(36, 72)];
  }
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.trim().toUpperCase().replace(/\s/g, '')).filter(Boolean);
}

export function parseMrz(raw) {
  if (!raw || typeof raw !== 'string') {
    return { docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw: '', checks: { ok: false, reason: 'empty_input' } };
  }
  const lines = normalizeMrzLines(raw);
  if (lines.length >= 2 && lines[0].length >= 38) return parseTD3(lines);
  if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) return parseTD2(lines);
  if (lines.length >= 3 && lines[0].length >= 28) return parseTD1(lines);
  return { docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw, checks: { ok: false, reason: 'invalid_format' } };
}

// fixMrzOcrErrors yalnızca "export function" ile dışa aktarılır; burada tekrarlanmamalı (duplicate export hatası).
export { checkDigit, normalizeYYMMDD };
