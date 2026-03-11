/**
 * Kimlik kartı (eID) NFC okuma: DG1 / DG2.
 * eMRTD (ICAO 9303) yapısı; Türk kimlik için ortak alanlar.
 */

function isSuccessResponse(bytes) {
  if (!bytes || !Array.isArray(bytes)) return false;
  const len = bytes.length;
  return len >= 2 && bytes[len - 2] === 0x90 && bytes[len - 1] === 0x00;
}

/** 61 XX = başarı, XX byte GET RESPONSE ile alınacak */
function isGetResponseNeeded(bytes) {
  if (!bytes || bytes.length < 2) return null;
  const sw1 = bytes[bytes.length - 2];
  const sw2 = bytes[bytes.length - 1];
  if (sw1 === 0x61) return sw2; // Le
  return null;
}

function getDataBytes(response) {
  if (!response || response.length <= 2) return [];
  return response.slice(0, -2);
}

/**
 * GET DATA yanıtı 61 XX ise GET RESPONSE (00 C0 00 00 XX) gönder; birleştir. Türk kimlik çipleri sık 61 XX döner.
 */
async function getDataWithResponse(transceiveFn, cmd) {
  const res = await transceiveFn(cmd);
  const le = isGetResponseNeeded(res);
  if (le != null && le > 0) {
    try {
      const getResponse = [0x00, 0xc0, 0x00, 0x00, le & 0xff];
      const res2 = await transceiveFn(getResponse);
      if (isSuccessResponse(res2)) {
        return getDataBytes(res2);
      }
    } catch (_) {}
  }
  if (isSuccessResponse(res)) {
    const bytes = getDataBytes(res);
    if (bytes && bytes.length > 0) return bytes;
  }
  return [];
}

/**
 * GET DATA ile DG1 oku (eMRTD).
 * Önce 0x0100, 0x6100, 0x0101; 61 XX dönerse GET RESPONSE ile al. Yoksa READ BINARY dene.
 */
async function readDG1(transceiveFn) {
  if (typeof transceiveFn !== 'function') throw new Error('transceiveFn gerekli');
  const getDataAttempts = [
    [0x00, 0xca, 0x01, 0x00, 0x00],
    [0x00, 0xca, 0x61, 0x00, 0x00],
    [0x00, 0xca, 0x01, 0x01, 0x00],
  ];
  for (const cmd of getDataAttempts) {
    try {
      const bytes = await getDataWithResponse(transceiveFn, cmd);
      if (bytes && bytes.length > 0) return bytes;
    } catch (_) {}
  }
  return await readDG1ViaReadBinary(transceiveFn);
}

/** SELECT FILE (EF.DG1) + READ BINARY ile DG1 oku; bazı çipler GET DATA vermez. 61 XX dönerse GET RESPONSE kullan. */
async function readBinaryWithResponse(transceiveFn, readCmd) {
  const res = await transceiveFn(readCmd);
  const le = isGetResponseNeeded(res);
  if (le != null && le > 0) {
    try {
      const getResponse = [0x00, 0xc0, 0x00, 0x00, le & 0xff];
      const res2 = await transceiveFn(getResponse);
      if (isSuccessResponse(res2)) return getDataBytes(res2);
    } catch (_) {}
  }
  if (isSuccessResponse(res)) return getDataBytes(res);
  return [];
}

async function readDG1ViaReadBinary(transceiveFn) {
  try {
    const selectEf = [0x00, 0xa4, 0x02, 0x0c, 0x02, 0x01, 0x01];
    const resSelect = await transceiveFn(selectEf);
    if (!resSelect || !isSuccessResponse(resSelect)) return [];
    const chunks = [];
    let offset = 0;
    const maxChunks = 8;
    for (let i = 0; i < maxChunks; i++) {
      const readCmd = [0x00, 0xb0, (offset >> 8) & 0xff, offset & 0xff, 0xff];
      const data = await readBinaryWithResponse(transceiveFn, readCmd);
      if (!data || data.length === 0) break;
      chunks.push(data);
      offset += data.length;
      if (data.length < 0xff) break;
    }
    if (chunks.length === 0) return [];
    return chunks.reduce((acc, c) => acc.concat(c), []);
  } catch (_) {
    return [];
  }
}

/**
 * GET DATA ile DG2 oku (fotoğraf). 61 XX dönerse GET RESPONSE ile al.
 */
async function readDG2(transceiveFn) {
  if (typeof transceiveFn !== 'function') throw new Error('transceiveFn gerekli');
  const GET_DATA_DG2 = [0x00, 0xca, 0x02, 0x00, 0x00];
  const bytes = await getDataWithResponse(transceiveFn, GET_DATA_DG2);
  return bytes || [];
}

/** DG2 ham baytlarından yüz fotoğrafı (JPEG) çıkar. ICAO 9303: JPEG SOI 0xFF 0xD8 ... EOI 0xFF 0xD9 */
function extractFaceImageFromDG2(dg2Bytes) {
  if (!dg2Bytes || !Array.isArray(dg2Bytes) || dg2Bytes.length < 4) return null;
  const data = dg2Bytes;
  let soi = -1;
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0xff && data[i + 1] === 0xd8) {
      soi = i;
      break;
    }
  }
  if (soi < 0) return null;
  let eoi = -1;
  for (let j = soi + 2; j < data.length - 1; j++) {
    if (data[j] === 0xff && data[j + 1] === 0xd9) {
      eoi = j + 2;
      break;
    }
  }
  if (eoi < 0) return null;
  return data.slice(soi, eoi);
}

/**
 * GET DATA ile DG11 oku (ek bilgiler: doğum yeri, adres vb.); varsa TLV'dan alan çıkar.
 */
async function readDG11(transceiveFn) {
  try {
    const cmd = [0x00, 0xca, 0x0b, 0x00, 0x00];
    const res = await transceiveFn(cmd);
    if (!isSuccessResponse(res)) return null;
    return getDataBytes(res);
  } catch (_) {
    return null;
  }
}

/** TLV içinden 2-byte tag (0x5F 0x1C vb.) ile değer çıkar */
function extractFieldFromTLV(bytes, tagByte2) {
  if (!bytes || !Array.isArray(bytes)) return null;
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (bytes[i] === 0x5f && bytes[i + 1] === tagByte2) {
      const len = bytes[i + 2];
      if (i + 3 + len > bytes.length) return null;
      return bytesToUtf8(bytes.slice(i + 3, i + 3 + len)).replace(/\0/g, '').trim() || null;
    }
  }
  return null;
}

/**
 * DG1 ham baytlarından ad, soyad, belge no, doğum tarihi, uyruk çıkar.
 * eMRTD: ASN.1/TLV sarmalı olabilir (0x61, 0x5F1F); içeride MRZ 44/88 char (ICAO 9303).
 * Türk eID çipleri bazen sadece TLV (5F1E ad, 5F1F soyad, 5F20 kimlik no) döner — önce TLV dene.
 */
function parseDG1ToPayload(dg1Bytes) {
  const payload = {
    ad: '',
    soyad: '',
    kimlikNo: null,
    pasaportNo: null,
    dogumTarihi: null,
    uyruk: 'TÜRK',
    cinsiyet: null,
    sonKullanma: null,
  };
  if (!dg1Bytes || dg1Bytes.length === 0) return payload;

  // TLV önce: Türk kimlik çipleri sıklıkla 0x61 / 0x5F ile sarılı TLV döner
  const firstByte = dg1Bytes[0];
  if (firstByte === 0x61 || firstByte === 0x5f) {
    try {
      parseTLV(dg1Bytes, payload);
      // Bazen tek alanda "SOYAD<<AD" gelir; ayır
      if (payload.soyad && !payload.ad && payload.soyad.includes('<<')) {
        const parts = payload.soyad.split('<<').map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          payload.soyad = parts[0] || '';
          payload.ad = parts.slice(1).join(' ') || '';
        }
        if (parts.length === 1 && parts[0]) payload.soyad = parts[0];
      }
      if (payload.ad || payload.soyad || payload.kimlikNo || payload.pasaportNo) {
        return payload;
      }
    } catch (_) {}
  }

  const rawMrz = unwrapDG1ToMRZ(dg1Bytes);
  if (rawMrz && rawMrz.length >= 44) {
    let mrzStr = Array.isArray(rawMrz) ? bytesToUtf8(rawMrz) : String(rawMrz);
    mrzStr = mrzStr.replace(/\0/g, '').replace(/\s+/g, '').trim().toUpperCase();
    // Türk kimlik TD1: 3x30 karakter (90). Önce lib/mrz parseMrz ile dene.
    if (mrzStr.length >= 86 && mrzStr.length <= 94) {
      try {
        const { parseMrz } = require('../../lib/mrz');
        const parsed = parseMrz(mrzStr);
        if (parsed && (parsed.surname || parsed.givenNames || parsed.passportNumber)) {
          payload.ad = parsed.givenNames || '';
          payload.soyad = parsed.surname || '';
          const doc = (parsed.passportNumber || '').trim();
          payload.kimlikNo = /^\d{11}$/.test(doc) ? doc : null;
          payload.pasaportNo = payload.kimlikNo ? null : (doc || null);
          payload.dogumTarihi = parsed.birthDate ? formatDDMMYYYY(parsed.birthDate) : null;
          payload.uyruk = (parsed.nationality || parsed.issuingCountry || 'TÜRK').trim();
          payload.cinsiyet = parsed.sex || null;
          payload.sonKullanma = parsed.expiryDate ? formatDDMMYYYY(parsed.expiryDate) : null;
          return payload;
        }
      } catch (_) {}
    }
    const parsed = parseMRZICAO9303(rawMrz);
    if (parsed) {
      payload.ad = parsed.givenNames || '';
      payload.soyad = parsed.surname || '';
      const doc = (parsed.documentNumber || '').trim();
      payload.kimlikNo = /^\d{11}$/.test(doc) ? doc : null;
      payload.pasaportNo = payload.kimlikNo ? null : (doc || null);
      payload.dogumTarihi = parsed.birthDate ? formatDDMMYYYY(parsed.birthDate) : null;
      payload.uyruk = (parsed.nationality || 'TÜRK').trim();
      payload.cinsiyet = parsed.sex || null;
      payload.sonKullanma = parsed.expiryDate ? formatDDMMYYYY(parsed.expiryDate) : null;
      return payload;
    }
  }

  const mrzFromBytes = extractMRZFromBytes(dg1Bytes);
  if (mrzFromBytes) {
    payload.ad = mrzFromBytes.givenNames || '';
    payload.soyad = mrzFromBytes.surname || '';
    const doc = (mrzFromBytes.documentNumber || '').trim();
    payload.kimlikNo = /^\d{11}$/.test(doc) ? doc : null;
    payload.pasaportNo = payload.kimlikNo ? null : (doc || null);
    payload.dogumTarihi = mrzFromBytes.birthDate ? formatDDMMYYYY(mrzFromBytes.birthDate) : null;
    payload.uyruk = (mrzFromBytes.nationality || 'TÜRK').trim();
    return payload;
  }

  try {
    const str = bytesToUtf8(dg1Bytes);
    if (str && str.includes('<')) {
      const mrz = parseMRZFromString(str);
      if (mrz) {
        payload.ad = mrz.givenNames || '';
        payload.soyad = mrz.surname || '';
        payload.kimlikNo = /^\d{11}$/.test(mrz.documentNumber || '') ? mrz.documentNumber : null;
        payload.pasaportNo = payload.kimlikNo ? null : (mrz.documentNumber || null);
        payload.dogumTarihi = mrz.birthDate ? formatDDMMYYYY(mrz.birthDate) : null;
        payload.uyruk = (mrz.nationality || 'TÜRK').trim();
        return payload;
      }
    }
  } catch (_) {}

  try {
    parseTLV(dg1Bytes, payload);
  } catch (_) {}

  return payload;
}

/** BER length: 81 XX = 1 byte, 82 XX XX = 2 byte */
function readBerLength(data, offset) {
  if (offset >= data.length) return { len: 0, next: offset };
  const b = data[offset];
  if (b < 0x80) return { len: b, next: offset + 1 };
  if (b === 0x81 && offset + 2 <= data.length) return { len: data[offset + 1], next: offset + 2 };
  if (b === 0x82 && offset + 3 <= data.length) return { len: (data[offset + 1] << 8) | data[offset + 2], next: offset + 3 };
  return { len: 0, next: offset + 1 };
}

/**
 * DG1 ASN.1/TLV sarmalayıcıyı aç; içerideki MRZ ham metnini döndür (byte array).
 * Tag 0x61 (application template) veya 0x5F1F (MRZ) içinde MRZ olabilir. BER length (81/82) destekli.
 */
function unwrapDG1ToMRZ(bytes) {
  if (!bytes || bytes.length < 10) return null;
  const data = bytes;
  let pos = 0;
  while (pos < data.length) {
    const tag1 = data[pos];
    let valueStart;
    let len;
    if (tag1 === 0x5f && pos + 2 < data.length) {
      const lenInfo = readBerLength(data, pos + 2);
      len = lenInfo.len;
      valueStart = lenInfo.next;
    } else if (tag1 === 0x61 && pos + 1 < data.length) {
      const lenInfo = readBerLength(data, pos + 1);
      len = lenInfo.len;
      valueStart = lenInfo.next;
    } else {
      if (pos + 2 > data.length) break;
      len = data[pos + 1];
      valueStart = pos + 2;
      if (len >= 0x80) {
        const lenInfo = readBerLength(data, pos + 1);
        len = lenInfo.len;
        valueStart = lenInfo.next;
      }
    }
    if (valueStart + len > data.length) break;
    const value = data.slice(valueStart, valueStart + len);
    if (tag1 === 0x5f && data[pos + 1] === 0x1f && len >= 44) return value;
    if (tag1 === 0x61 && len >= 2) {
      const inner = unwrapDG1ToMRZ(value);
      if (inner) return inner;
    }
    pos = valueStart + len;
  }
  if (bytes.length >= 44 && bytes[0] !== 0x61 && bytes[0] !== 0x5f) return bytes;
  const str = bytesToUtf8(bytes).replace(/\0/g, '').trim();
  if (str.length >= 86 && str.length <= 94 && /^[IA]/.test(str)) return bytes;
  if (/[PIA][A-Z0-9<]{43,}/.test(str)) return bytes;
  return null;
}

/**
 * ICAO 9303 TD3: 2 satır x 44 karakter. Doğru pozisyonlarla parse et.
 * Line 1: 0-2 docCode, 2-5 country, 5-44 name (surname<<givennames)
 * Line 2: 0-9 docNumber, 10-13 nationality, 13-19 birth YYMMDD, 20 sex, 21-27 expiry
 */
function parseMRZICAO9303(rawMrz) {
  const str = Array.isArray(rawMrz) ? bytesToUtf8(rawMrz) : String(rawMrz);
  let line1 = '';
  let line2 = '';
  if (str.length >= 88) {
    line1 = str.slice(0, 44);
    line2 = str.slice(44, 88);
  } else {
    const lines = str.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length >= 44);
    line1 = lines.find((l) => /^[PIA]/.test(l)) || '';
    line2 = lines.find((l) => l.length === 44 && l !== line1 && /^[A-Z0-9<]+$/.test(l)) || lines[1] || '';
  }
  if (!line2 || line2.length < 44) return null;
  const docNum = (line2.slice(0, 9) || '').replace(/</g, '').trim();
  const nationality = (line2.slice(10, 13) || '').replace(/</g, '') || 'TUR';
  const birth = line2.slice(13, 19);
  const sex = (line2.slice(20, 21) || '').replace(/</g, '') || null;
  const expiry = line2.slice(21, 27);
  const birthDate = birth.length === 6 ? `20${birth.slice(0, 2)}-${birth.slice(2, 4)}-${birth.slice(4, 6)}` : null;
  const expiryDate = expiry.length === 6 ? `20${expiry.slice(0, 2)}-${expiry.slice(2, 4)}-${expiry.slice(4, 6)}` : null;
  let surname = '';
  let givenNames = '';
  if (line1 && line1.length >= 44) {
    const nameBlock = (line1.slice(5, 44) || '').replace(/</g, ' ').trim();
    const parts = nameBlock.split(/\s*<<\s*/);
    surname = (parts[0] || '').trim();
    givenNames = (parts[1] || '').trim();
  }
  return {
    documentNumber: docNum,
    nationality,
    birthDate,
    expiryDate,
    sex,
    surname,
    givenNames,
  };
}

/** Ham bayt dizisinde MRZ satırlarını tara (44/88 char), parse et */
function extractMRZFromBytes(bytes) {
  if (!bytes || bytes.length < 44) return null;
  const str = bytesToUtf8(bytes);
  const lines = str.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 20);
  const line2 = lines.find((l) => /^[A-Z0-9<]+$/.test(l) && (l.length === 44 || l.length === 88));
  const line1 = lines.find((l) => /^[PIA][A-Z<]/.test(l) && l.includes('<')); // P<, I<, A<
  let surname = '';
  let givenNames = '';
  if (line1) {
    const parts = line1.split('<<');
    surname = (parts[1] || '').replace(/</g, ' ').trim();
    givenNames = (parts[2] || parts[1] ? '' : line1.slice(5)).replace(/</g, ' ').trim();
    if (!givenNames && parts[0]) {
      const afterDocType = (parts[0] || '').slice(5);
      const again = afterDocType.split('<<');
      surname = (again[0] || '').replace(/</g, ' ').trim();
      givenNames = (again[1] || '').replace(/</g, ' ').trim();
    }
  }
  if (!line2) {
    const singleLine = str.replace(/\s/g, '');
    const m = singleLine.match(/[A-Z0-9<]{44,88}/);
    if (m) {
      const r = parseMRZLine2(m[0]);
      if (r) {
        r.surname = surname || r.surname;
        r.givenNames = givenNames || r.givenNames;
        return r;
      }
      return null;
    }
    return null;
  }
  const r = parseMRZLine2(line2);
  if (r) {
    r.surname = surname || r.surname;
    r.givenNames = givenNames || r.givenNames;
  }
  return r;
}

/** ICAO 9303 TD3 Line 2: 0-9 docNo, 10-13 nationality, 13-19 birth, 20 sex, 21-27 expiry */
function parseMRZLine2(line2) {
  const docNum = (line2.slice(0, 9) || '').replace(/</g, '').trim();
  const nationality = (line2.slice(10, 13) || '').replace(/</g, '') || 'TUR';
  const birth = line2.slice(13, 19);
  const expiry = line2.slice(21, 27);
  const birthDate = birth.length === 6 ? `20${birth.slice(0, 2)}-${birth.slice(2, 4)}-${birth.slice(4, 6)}` : null;
  return {
    documentNumber: docNum,
    birthDate,
    expiryDate: expiry.length === 6 ? `20${expiry.slice(0, 2)}-${expiry.slice(2, 4)}-${expiry.slice(4, 6)}` : null,
    nationality,
    surname: '',
    givenNames: '',
  };
}

function bytesToUtf8(arr) {
  if (!arr || !Array.isArray(arr)) return '';
  try {
    return decodeURIComponent(escape(String.fromCharCode.apply(null, arr)));
  } catch {
    return String.fromCharCode.apply(null, arr);
  }
}

function formatDDMMYYYY(yyyymmdd) {
  if (!yyyymmdd) return null;
  const s = String(yyyymmdd).replace(/-/g, '');
  if (s.length === 8) return `${s.slice(6, 8)}.${s.slice(4, 6)}.${s.slice(0, 4)}`;
  if (s.length === 6) return `${s.slice(4, 6)}.${s.slice(2, 4)}.20${s.slice(0, 2)}`;
  return null;
}

function parseMRZFromString(str) {
  const lines = str.split(/\r?\n/).filter((l) => l.length >= 44);
  const line2 = lines.find((l) => /^[A-Z0-9<]{44}$/.test(l) && !/^[PIA]</.test(l)) || lines[1] || lines[0];
  if (!line2 || line2.length < 44) return null;
  const docNum = (line2.slice(0, 9) || '').replace(/</g, '').trim();
  const nationality = (line2.slice(10, 13) || '').replace(/</g, '') || 'TUR';
  const birth = line2.slice(13, 19);
  const expiry = line2.slice(21, 27);
  const line1 = lines.find((l) => /^[PIA]/.test(l)) || lines[0];
  let surname = '';
  let givenNames = '';
  if (line1 && line1.length >= 44) {
    const nameBlock = (line1.slice(5, 44) || '').replace(/</g, ' ').trim();
    const parts = nameBlock.split(/\s*<<\s*/);
    surname = (parts[0] || '').trim();
    givenNames = (parts[1] || '').trim();
  }
  const birthDate = birth.length === 6 ? `20${birth.slice(0, 2)}-${birth.slice(2, 4)}-${birth.slice(4, 6)}` : null;
  const expiryDate = expiry.length === 6 ? `20${expiry.slice(0, 2)}-${expiry.slice(2, 4)}-${expiry.slice(4, 6)}` : null;
  return {
    documentNumber: docNum,
    birthDate,
    expiryDate,
    nationality,
    surname,
    givenNames,
  };
}

/** TLV parse: 2-byte tag (0x5F 0x1E = ad, 0x5F 0x1F = soyad vb.). 0x61 (application template) içini özyinelemeli parse et — Türk eID DG1 böyle sarılı. */
function parseTLV(bytes, payload) {
  if (!bytes || !Array.isArray(bytes)) return;
  let i = 0;
  while (i + 2 <= bytes.length) {
    const tag = bytes[i];
    if (tag === 0x5f && i + 3 <= bytes.length) {
      const tagByte2 = bytes[i + 1];
      let len = bytes[i + 2];
      let valueStart = i + 3;
      if (len === 0x81 && valueStart + 1 <= bytes.length) {
        len = bytes[valueStart];
        valueStart += 1;
      } else if (len === 0x82 && valueStart + 2 <= bytes.length) {
        len = (bytes[valueStart] << 8) | bytes[valueStart + 1];
        valueStart += 2;
      }
      if (valueStart + len > bytes.length) break;
      const value = bytes.slice(valueStart, valueStart + len);
      const str = bytesToUtf8(value).replace(/\0/g, '').trim();
      if (tagByte2 === 0x1e && str) payload.ad = str;
      else if (tagByte2 === 0x1f && str) payload.soyad = str;
      else if (tagByte2 === 0x20 && str) payload.kimlikNo = str || null;
      else if (tagByte2 === 0x2b && str) payload.dogumTarihi = str || null;
      else if (tagByte2 === 0x2c && str) payload.uyruk = str || payload.uyruk;
      i = valueStart + len;
    } else if (tag === 0x61 && i + 2 <= bytes.length) {
      let len = bytes[i + 1];
      let valueStart = i + 2;
      if (len === 0x81 && valueStart + 1 <= bytes.length) {
        len = bytes[valueStart];
        valueStart += 1;
      } else if (len === 0x82 && valueStart + 2 <= bytes.length) {
        len = (bytes[valueStart] << 8) | bytes[valueStart + 1];
        valueStart += 2;
      }
      if (valueStart + len <= bytes.length) {
        const inner = bytes.slice(valueStart, valueStart + len);
        parseTLV(inner, payload);
      }
      i = valueStart + len;
    } else {
      i += 1;
      let len = bytes[i];
      if (len === 0x81 && i + 2 <= bytes.length) {
        len = bytes[i + 1];
        i += 2;
      } else if (len === 0x82 && i + 3 <= bytes.length) {
        len = (bytes[i + 1] << 8) | bytes[i + 2];
        i += 3;
      } else {
        i += 1;
      }
      i += len || 0;
      if (i > bytes.length) break;
    }
  }
}

module.exports = {
  readDG1,
  readDG2,
  readDG11,
  parseDG1ToPayload,
  extractFieldFromTLV,
  extractFaceImageFromDG2,
};
