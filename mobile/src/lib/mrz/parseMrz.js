/**
 * MRZ ham string parse - TD3 (pasaport) ve TD1 (kimlik). Check digit: ICAO 9303.
 */

const TD3_LINE_LEN = 44;
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

export function parseMrz(raw) {
  if (!raw || typeof raw !== 'string') {
    return { docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw: '', checks: { ok: false, reason: 'empty_input' } };
  }
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((l) => l.trim().toUpperCase().replace(/\s/g, '')).filter(Boolean);
  if (lines.length >= 2 && lines[0].length >= 40) return parseTD3(lines);
  if (lines.length >= 3 && lines[0].length >= 28) return parseTD1(lines);
  return { docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw, checks: { ok: false, reason: 'invalid_format' } };
}

export { checkDigit, normalizeYYMMDD };
