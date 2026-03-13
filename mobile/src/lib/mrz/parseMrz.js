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

/**
 * TD1: Türk Kimlik Kartı (3 satır, 30 karakter). ICAO 9303 + Türk kimlik alan konumları.
 * Satır 1: belge no 5-14, TC no 14-25. Satır 2: doğum 0-6, cinsiyet [6], son kullanma 7-13, uyruk 13-16.
 * Satır 3: SOYAD<<AD (<< ile ayrılmış).
 */
function parseTD1(lines) {
  const line1 = (lines[0] || '').padEnd(30, '<').substring(0, 30);
  const line2 = (lines[1] || '').padEnd(30, '<').substring(0, 30);
  const line3 = (lines[2] || '').padEnd(30, '<').substring(0, 30);

  const docType = line1[0] === 'I' || line1[0] === 'A' ? 'ID' : 'OTHER';
  const issuingCountry = line1.substring(2, 5).replace(/</g, '').trim();

  // Belge no (5-14: 9 karakter), TC kimlik no (14-25: 11 karakter). Türk kimlikte 14. konum TC'nin ilk hanesi.
  let belgeNo = line1.substring(5, 14).replace(/</g, '').trim();
  if (belgeNo.length > 9) belgeNo = belgeNo.substring(0, 9);
  const tcNo = line1.substring(14, 25).replace(/</g, '').trim();
  // ICAO'da doc check digit 14. konumda; Türk kimlikte 14-25 TC no olduğu için check digit atlanır.
  const docNoCheckOk = true;

  // Satır 2: doğum 0-6, cinsiyet [6], son kullanma 7-13, uyruk 13-16 (Türk kimlik konumları)
  // OCR: O/I/L/S/B/Z karışıklığını düzelt (ışık/hiza uyarısına rağmen okumayı kolaylaştır)
  const fixDateRaw = (s) => {
    if (!s || s.length < 6) return s;
    const map = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', '|': '1', J: '1', S: '5', B: '8', Z: '2', G: '6' };
    return s.split('').map((c) => map[c] ?? c).join('');
  };
  const birthDateRaw = fixDateRaw(line2.substring(0, 6));
  const cinsiyetChar = line2[6];
  const expiryDateRaw = fixDateRaw(line2.substring(7, 13));
  const uyruk = line2.substring(13, 16).replace(/</g, '').trim();
  // Türk kimlikte [6] cinsiyet; check digit yok. Geçerlilik: 6 haneli tarih formatı.
  const birthCheckOk = /^[0-9<]{6}$/.test(birthDateRaw);
  const expiryCheckOk = /^[0-9<]{6}$/.test(expiryDateRaw);

  const birthDate = normalizeYYMMDD(birthDateRaw);
  const sonKullanma = normalizeYYMMDD(expiryDateRaw);
  const sex = cinsiyetChar === 'M' || cinsiyetChar === 'F' ? cinsiyetChar : cinsiyetChar === '<' ? 'U' : 'X';
  const cinsiyet = cinsiyetChar === 'M' ? 'ERKEK' : cinsiyetChar === 'F' ? 'KADIN' : '';

  // Satır 3: SOYAD<<AD
  const soyad = (line3.split('<<')[0] || '').replace(/</g, ' ').trim();
  const ad = (line3.split('<<')[1] || '').replace(/</g, ' ').trim();

  const checksOk = docNoCheckOk && birthCheckOk && expiryCheckOk;
  let reason = !docNoCheckOk ? 'document_number_check' : !birthCheckOk ? 'birth_date_check' : !expiryCheckOk ? 'expiry_date_check' : '';

  return {
    docType,
    issuingCountry,
    // Türk kimlik (KBS Prime) alan adları
    belgeTuru: 'KİMLİK',
    belgeNo,
    tcNo,
    dogumTarihi: birthDate,
    cinsiyet,
    sonKullanma,
    uyruk,
    soyad,
    ad,
    // Genel MRZ alanları (mevcut kod uyumluluğu)
    surname: soyad,
    givenNames: ad,
    passportNumber: belgeNo,
    nationality: uyruk,
    birthDate,
    sex,
    expiryDate: sonKullanma,
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
/** Belge no / check digit – yaygın karışıklıklar (0/O, 1/I/L, 5/S, 8/B, 2/Z, 6/G). */
const OCR_DIGIT_SAFE = { O: '0', Q: '0', I: '1', L: '1', '|': '1', J: '1', S: '5', B: '8', Z: '2', G: '6', C: '6' };
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
  let lines = normalizeMrzLines(raw);
  for (let pass = 0; pass < 2; pass++) {
    if (lines.length >= 2 && lines[0].length >= 30) {
      // TD3 pasaport: 2. satır doc 0-9, birth 13-19, expiry 21-27
      lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
    }
    if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) {
      lines[1] = fixLineDigitPositions(lines[1], [[0, 10], [13, 20], [21, 28]]);
    } else if (lines.length >= 3 && lines[0].length >= 28) {
      lines[0] = fixLineDigitPositions(lines[0], [[5, 15]]);
      lines[1] = fixLineDigitPositions(lines[1], [[0, 8], [8, 15]]);
    }
  }
  return lines.join('\n');
}

/** Ham MRZ'ı satırlara böl. OCR birleşik satır: önce tek blok temizle, TD1 3x30 / TD3 2x44 ayır. */
function normalizeMrzLines(raw) {
  const one = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, '');
  const isIdCard = one[0] === 'I' || one[0] === 'A';
  // Birleşik satır: newline yok, uzunluk TD1 veya TD3 aralığında
  const noNewline = !/[\n\r]/.test(raw.trim());
  if (noNewline && one.length >= 86 && one.length <= 94 && isIdCard) {
    const s1 = one.slice(0, 30).padEnd(30, '<');
    const s2 = one.slice(30, 60).padEnd(30, '<');
    const s3 = one.slice(60).padEnd(30, '<');
    return [s1, s2, s3];
  }
  if (noNewline && one.length >= 88 && one.length <= 100) {
    const s1 = one.slice(0, 44).padEnd(44, '<');
    const s2 = one.slice(44, 88).padEnd(44, '<');
    return [s1, s2];
  }
  // Kimlik (TD1): 3 satır — 86–94 karakter I/A ile başlarsa
  if (one.length >= 86 && one.length <= 94 && (one.length !== 88 || isIdCard)) {
    const s1 = one.slice(0, 30).padEnd(30, '<');
    const s2 = one.slice(30, 60).padEnd(30, '<');
    const s3 = one.slice(60).padEnd(30, '<');
    return [s1, s2, s3];
  }
  // Pasaport (TD3): 2×44 — 66–100 karakter
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

  // TD1 (Türk kimlik): 3 satır — her biri 30 karaktere pad et
  if (lines.length >= 3 && (lines[0][0] === 'I' || lines[0][0] === 'A')) {
    const l1 = (lines[0] || '').padEnd(TD1_LINE_LEN, '<').substring(0, TD1_LINE_LEN);
    const l2 = (lines[1] || '').padEnd(TD1_LINE_LEN, '<').substring(0, TD1_LINE_LEN);
    const l3 = (lines[2] || '').padEnd(TD1_LINE_LEN, '<').substring(0, TD1_LINE_LEN);
    if (l1.length >= 28 && l2.length >= 28 && l3.length >= 10) {
      return [l1, l2, l3];
    }
  }
  if (lines.length >= 2 && lines[0].length >= 28 && lines[1].length >= 28) {
    const total = lines[0].length + lines[1].length;
    if (total >= 72 && total <= 76 && lines[0].length >= 34 && lines[0].length <= 36) {
      return [lines[0].padEnd(36, '<').slice(0, 36), lines[1].padEnd(36, '<').slice(0, 36)];
    }
    if (total >= 68 && total <= 100) {
      return [lines[0].padEnd(44, '<').slice(0, 44), lines[1].padEnd(44, '<').slice(0, 44)];
    }
  }
  // OCR bazen satırları yanlış böler (örn. 20+64). Toplam 66–100 ise birleştirip 44 veya 42’ye böl.
  if (lines.length >= 2) {
    const joined = lines.join('').replace(/[^A-Z0-9<]/g, '');
    if (joined.length >= 66 && joined.length <= 100 && (lines[0].length < 28 || lines[1].length < 28)) {
      for (const splitAt of [44, 42, 43, 45, 41, 40]) {
        if (splitAt < joined.length && joined.length - splitAt >= 28) {
          return [joined.slice(0, splitAt).padEnd(44, '<').slice(0, 44), joined.slice(splitAt).padEnd(44, '<').slice(0, 44)];
        }
      }
    }
  }
  return lines;
}

function parseMrzWithLines(lines) {
  // TD1 (Türk kimlik) önce — 3 satır, her biri 28+ karakter
  if (lines.length >= 3 && (lines[0][0] === 'I' || lines[0][0] === 'A') && lines[0].length >= 28) {
    const td1Lines = [
      (lines[0] || '').padEnd(TD1_LINE_LEN, '<').substring(0, TD1_LINE_LEN),
      (lines[1] || '').padEnd(TD1_LINE_LEN, '<').substring(0, TD1_LINE_LEN),
      (lines[2] || '').padEnd(TD1_LINE_LEN, '<').substring(0, TD1_LINE_LEN),
    ];
    return parseTD1(td1Lines);
  }
  if (lines.length >= 2 && lines[0].length >= 34 && lines[0].length <= 36) return parseTD2(lines);
  // TD3 pasaport: 2 satır 28+
  if (lines.length >= 2 && lines[0].length >= 28) return parseTD3(lines);
  if (lines.length >= 3 && lines[0].length >= 28) return parseTD1(lines);
  return null;
}

export function parseMrz(raw) {
  const emptyResult = {
    docType: 'OTHER', issuingCountry: '', surname: '', givenNames: '', passportNumber: '', nationality: '', birthDate: '', sex: 'U', expiryDate: '', raw: '', checks: { ok: false, reason: 'empty_input' },
    belgeTuru: '', belgeNo: '', tcNo: '', dogumTarihi: '', cinsiyet: '', sonKullanma: '', uyruk: '', soyad: '', ad: '',
  };
  if (!raw || typeof raw !== 'string') {
    return { ...emptyResult, raw: '' };
  }
  const cleaned = raw.replace(/[^A-Z0-9<\r\n]/gi, '').trim().toUpperCase();
  const lines = normalizeMrzLines(cleaned);
  let result = parseMrzWithLines(lines);
  if (result) return result;
  const one = cleaned.replace(/\s/g, '');
  // İran vb. pasaportlar: farklı bölme noktaları dene (tek satır 66–100 karakter). 42 karakter bazı pasaportlarda kullanılır.
  if (one.length >= 66 && one.length <= 100) {
    for (const splitAt of [44, 42, 43, 45, 46, 41, 40, 39]) {
      if (splitAt >= one.length) continue;
      const l1 = one.slice(0, splitAt).padEnd(44, '<');
      const l2 = one.slice(splitAt).padEnd(44, '<');
      result = parseMrzWithLines([l1, l2]);
      if (result && result.passportNumber) return result;
    }
    // Check digit hatalı olsa bile veri doluysa döndür (kullanıcı sonuç ekranında düzeltebilir)
    for (const splitAt of [44, 42, 43]) {
      if (splitAt >= one.length) continue;
      const l1 = one.slice(0, splitAt).padEnd(44, '<');
      const l2 = one.slice(splitAt).padEnd(44, '<');
      result = parseMrzWithLines([l1, l2]);
      if (result && result.passportNumber && (result.birthDate || result.expiryDate)) return result;
    }
  }
  return { ...emptyResult, raw: cleaned || raw, checks: { ok: false, reason: 'invalid_format' } };
}

// fixMrzOcrErrors yalnızca "export function" ile dışa aktarılır; burada tekrarlanmamalı (duplicate export hatası).
export { checkDigit, normalizeYYMMDD };
