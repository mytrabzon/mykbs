/**
 * DG1 (eMRTD ICAO 9303) parse: TD1 (kimlik 3x30) ve TD3 (pasaport 2x44).
 * Ham DG1 buffer veya MRZ metni ile kullanılabilir.
 */

/** YYMMDD → YYYY-MM-DD (ICAO 9303 tarih formatı). */
function formatDate(yymmdd) {
  if (!yymmdd || typeof yymmdd !== 'string') return null;
  const s = yymmdd.replace(/\s/g, '').replace(/</g, '');
  if (s.length < 6) return null;
  const yy = s.slice(0, 2);
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  const yyyy = parseInt(yy, 10) < 50 ? `20${yy}` : `19${yy}`;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * DG1 ham buffer veya MRZ string'ini parse et.
 * TD1 (Türk kimlik): 3 satır x 30 karakter (90). personalNumber = TC No.
 * TD3 (Pasaport): 2 satır x 44 karakter (88).
 * @param {Buffer|Uint8Array|number[]|string} dg1Buffer
 * @returns {{ documentType: string; issuingCountry: string; documentNumber: string; personalNumber?: string; birthDate: string; sex: string; expiryDate: string; nationality: string; surname: string; givenName: string } | null}
 */
function parseDG1(dg1Buffer) {
  let data;
  if (typeof dg1Buffer === 'string') {
    data = dg1Buffer;
  } else if (dg1Buffer && (Array.isArray(dg1Buffer) || (typeof Uint8Array !== 'undefined' && dg1Buffer instanceof Uint8Array))) {
    const arr = Array.isArray(dg1Buffer) ? dg1Buffer : Array.from(dg1Buffer);
    data = arr.map((b) => String.fromCharCode(b & 0xff)).join('');
  } else if (dg1Buffer && typeof dg1Buffer.toString === 'function') {
    data = dg1Buffer.toString('ascii');
  } else {
    return null;
  }
  data = data.replace(/\0/g, '').trim();

  // TD1 formatı (Türk kimlik kartı): 3 satır, her biri 30 karakter (ICAO 9303)
  if (data.length >= 90) {
    const line1 = data.substring(0, 30);
    const line2 = data.substring(30, 60);
    const line3 = data.substring(60, 90);
    if (/^[IA]/.test(line1) && line2.length >= 17) {
      const docType = (line1.substring(0, 2) || '').replace(/</g, '');
      const issuingCountry = (line1.substring(2, 5) || '').replace(/</g, '');
      const documentNumber = (line1.substring(5, 14) || '').replace(/</g, '').trim();
      const birthDate = formatDate(line2.substring(0, 6));
      const sex = (line2.substring(7, 8) || '').replace(/</g, '') || '';
      const expiryDate = formatDate(line2.substring(8, 14));
      const nationality = (line2.substring(15, 18) || '').replace(/</g, '') || 'TUR';
      const personalNumber = (line2.substring(18, 30) || '').replace(/</g, '').trim(); // TC No
      const nameBlock = (line3 || '').replace(/</g, ' ');
      const nameParts = nameBlock.split(/\s*<<\s*/).map((s) => s.trim());
      const surname = nameParts[0] || '';
      const ad = nameParts[1] || '';
      const babaAdi = nameParts[2] || '';
      const anaAdi = nameParts[3] || '';
      return {
        documentType: docType,
        issuingCountry: issuingCountry,
        documentNumber: documentNumber,
        personalNumber: personalNumber || undefined,
        birthDate: birthDate || '',
        sex,
        expiryDate: expiryDate || '',
        nationality,
        surname,
        givenName: ad,
        babaAdi: babaAdi || undefined,
        anaAdi: anaAdi || undefined,
      };
    }
  }

  // TD2 formatı (Visa / ehliyet / ikamet): 2 satır x 36 karakter (72)
  if (data.length >= 72 && data.includes('<')) {
    const line1 = data.substring(0, 36);
    const line2 = data.substring(36, 72);
    if (/^[IAVC]/.test(line1) && line2.length >= 22) {
      const docType = (line1.substring(0, 2) || '').replace(/</g, '');
      const issuingCountry = (line1.substring(2, 5) || '').replace(/</g, '');
      const nameBlock = (line1.substring(5, 36) || '').replace(/</g, ' ');
      const nameParts = nameBlock.split(/\s*<<\s*/).map((s) => s.trim()).filter(Boolean);
      const surname = nameParts[0] || '';
      const givenName = nameParts.slice(1).join(' ') || '';
      const documentNumber = (line2.substring(0, 9) || '').replace(/</g, '').trim();
      const birthDate = formatDate(line2.substring(9, 15));
      const sex = (line2.substring(15, 16) || '').replace(/</g, '') || '';
      const expiryDate = formatDate(line2.substring(16, 22));
      const nationality = (line2.substring(22, 25) || '').replace(/</g, '') || '';
      const personalNumber = (line2.substring(25, 36) || '').replace(/</g, '').trim();
      return {
        format: 'TD2',
        documentType: docType,
        issuingCountry: issuingCountry,
        documentNumber: documentNumber,
        personalNumber: personalNumber || undefined,
        birthDate: birthDate || '',
        sex,
        expiryDate: expiryDate || '',
        nationality: nationality || 'TUR',
        surname,
        givenName,
      };
    }
  }

  // TD3 formatı (Pasaport): 2 satır x 44 karakter
  if (data.length >= 88) {
    const line1 = data.substring(0, 44);
    const line2 = data.substring(44, 88);
    if (/^[PIA]/.test(line1) && line2.length >= 27) {
      const docType = (line1.substring(0, 2) || '').replace(/</g, '');
      const issuingCountry = (line1.substring(2, 5) || '').replace(/</g, '');
      const nameBlock = (line1.substring(5, 44) || '').replace(/</g, ' ');
      const nameParts = nameBlock.split(/\s*<<\s*/).map((s) => s.trim()).filter(Boolean);
      const surname = nameParts[0] || '';
      const givenName = nameParts.slice(1).join(' ') || '';
      const documentNumber = (line2.substring(0, 9) || '').replace(/</g, '').trim();
      const nationality = (line2.substring(10, 13) || '').replace(/</g, '') || 'TUR';
      const birthDate = formatDate(line2.substring(13, 19));
      const sex = (line2.substring(20, 21) || '').replace(/</g, '') || '';
      const expiryDate = formatDate(line2.substring(21, 27));
      return {
        format: 'TD3',
        documentType: docType,
        issuingCountry: issuingCountry,
        documentNumber: documentNumber,
        birthDate: birthDate || '',
        sex,
        expiryDate: expiryDate || '',
        nationality,
        surname,
        givenName,
      };
    }
  }

  return null;
}

/**
 * DG1 ham buffer'ı evrensel parse et: TD1 (kimlik), TD2 (ehliyet/ikamet), TD3 (pasaport).
 * Çıktıda format alanı eklenir; uygulama tarafında ad/soyad için surname + givenName kullanılır.
 * @param {Buffer|Uint8Array|number[]|string} dg1Buffer
 * @returns {{ format: string; documentType: string; issuingCountry: string; documentNumber: string; personalNumber?: string; birthDate: string; sex: string; expiryDate: string; nationality: string; surname: string; givenName: string } | { format: 'UNKNOWN'; raw: string }}
 */
function parseDG1Universal(dg1Buffer) {
  let data;
  if (typeof dg1Buffer === 'string') {
    data = dg1Buffer;
  } else if (dg1Buffer && (Array.isArray(dg1Buffer) || (typeof Uint8Array !== 'undefined' && dg1Buffer instanceof Uint8Array))) {
    const arr = Array.isArray(dg1Buffer) ? dg1Buffer : Array.from(dg1Buffer);
    data = arr.map((b) => String.fromCharCode(b & 0xff)).join('');
  } else if (dg1Buffer && typeof dg1Buffer.toString === 'function') {
    data = dg1Buffer.toString('ascii');
  } else {
    return { format: 'UNKNOWN', raw: '' };
  }
  data = data.replace(/\0/g, '').trim();
  const parsed = parseDG1(dg1Buffer);
  if (parsed) {
    if (!parsed.format) parsed.format = data.length >= 88 ? 'TD3' : data.length >= 72 ? 'TD2' : 'TD1';
    return parsed;
  }
  return { format: 'UNKNOWN', raw: data };
}

/**
 * DG11 ham baytlarından adres / doğum yeri çıkar (TLV 5F1C, 5F1D vb.).
 * @param {number[]|Uint8Array} dg11Bytes
 * @returns {{ placeOfBirth?: string; address?: string; raw?: string }}
 */
function parseDG11(dg11Bytes) {
  const result = {};
  if (!dg11Bytes || !Array.isArray(dg11Bytes) && !(typeof Uint8Array !== 'undefined' && dg11Bytes instanceof Uint8Array)) return result;
  const arr = Array.isArray(dg11Bytes) ? dg11Bytes : Array.from(dg11Bytes);
  try {
    const { extractFieldFromTLV } = require('./IdCardReader');
    result.placeOfBirth = extractFieldFromTLV(arr, 0x1c) || undefined;
    result.address = extractFieldFromTLV(arr, 0x1d) || undefined;
  } catch (_) {}
  return result;
}

module.exports = {
  parseDG1,
  parseDG1Universal,
  parseDG11,
  formatDate,
};
