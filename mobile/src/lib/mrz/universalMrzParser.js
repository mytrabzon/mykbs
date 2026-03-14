/**
 * KBS Prime - Evrensel MRZ Parser (mobil, backend ile aynı mantık)
 * TD1 / TD2 / TD3. Sadece parse için; OCR backend'de.
 */

export class UniversalMrzParser {
  static detectFormat(mrzText) {
    const lines = (mrzText || '')
      .trim()
      .split(/\r\n|\r|\n/)
      .map((l) => l.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, ''))
      .filter((l) => l.length > 20);

    if (lines.length === 3 && lines[0].length >= 28 && lines[0].length <= 30) return 'TD1';
    if (lines.length === 2 && lines[0].length >= 34 && lines[0].length <= 36) return 'TD2';
    if (lines.length === 2 && lines[0].length >= 42 && lines[0].length <= 44) return 'TD3';
    const one = (mrzText || '').replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
    if (one.length >= 86 && one.length <= 94 && (one[0] === 'I' || one[0] === 'A')) return 'TD1';
    if (one.length >= 70 && one.length <= 74) return 'TD2';
    if (one.length >= 80 && one.length <= 96 && one[0] === 'P') return 'TD3';
    return 'UNKNOWN';
  }

  static formatDate(yymmdd) {
    if (!yymmdd || typeof yymmdd !== 'string') return null;
    const raw = yymmdd.substring(0, 6).replace(/</g, '');
    const fix = { O: '0', Q: '0', I: '1', L: '1', S: '5', Z: '2', B: '8' };
    const normalized = raw.split('').map((c) => fix[c] || c).join('');
    if (!/^\d{6}$/.test(normalized)) return null;
    const yy = parseInt(normalized.substring(0, 2), 10);
    const month = normalized.substring(2, 4);
    const day = normalized.substring(4, 6);
    const mmNum = parseInt(month, 10);
    const ddNum = parseInt(day, 10);
    if (mmNum < 1 || mmNum > 12 || ddNum < 1 || ddNum > 31) return null;
    const fullYear = yy <= 30 ? 2000 + yy : 1900 + yy;
    return `${fullYear}-${month}-${day}`;
  }

  static parse(mrzText) {
    const cleaned = (mrzText || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^A-Za-z0-9<>\n]/g, '')
      .toUpperCase();
    const one = cleaned.replace(/\n/g, '').replace(/\s/g, '');
    const lines = cleaned.split(/\n/).map((l) => l.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, '')).filter((l) => l.length > 20);

    let actualLines = lines;
    if (lines.length < 2) {
      if (one.length >= 86 && one.length <= 94) {
        actualLines = [one.slice(0, 30).padEnd(30, '<'), one.slice(30, 60).padEnd(30, '<'), one.slice(60).padEnd(30, '<')];
      } else if (one.length >= 80 && one.length <= 96) {
        actualLines = [one.slice(0, 44).padEnd(44, '<'), one.slice(44).padEnd(44, '<')];
      } else if (one.length >= 70 && one.length <= 74) {
        actualLines = [one.slice(0, 36).padEnd(36, '<'), one.slice(36).padEnd(36, '<')];
      } else {
        return { format: 'UNKNOWN', raw: mrzText };
      }
    }

    const format = this.detectFormat(cleaned);
    if (format === 'TD1') return this._parseTD1(actualLines);
    if (format === 'TD2') return this._parseTD2(actualLines);
    if (format === 'TD3') return this._parseTD3(actualLines);
    return { format: 'UNKNOWN', raw: mrzText };
  }

  static _parseTD1(lines) {
    const line1 = (lines[0] || '').padEnd(30, '<').substring(0, 30);
    const line2 = (lines[1] || '').padEnd(30, '<').substring(0, 30);
    const line3 = (lines[2] || '').padEnd(30, '<').substring(0, 30);
    // TD1 satır 3: SOYAD<<AD<<BABA<<ANA (<< ile ayrı; baba/ana ayrı tutulur, karıştırılmaz)
    const nameParts = line3.split('<<').map((s) => s.replace(/</g, ' ').trim());
    const surname = (nameParts[0] || '').trim();
    const ad = (nameParts[1] || '').trim();
    const babaAdi = (nameParts[2] || '').trim();
    const anaAdi = (nameParts[3] || '').trim();
    const personalNumber = line2.substring(18, 29).replace(/</g, '').trim() || null;
    return {
      format: 'TD1',
      documentType: line1.substring(0, 2).replace(/</g, '').trim(),
      issuingCountry: line1.substring(2, 5).replace(/</g, '').trim(),
      documentNumber: line1.substring(5, 14).replace(/</g, '').trim(),
      personalNumber: /^\d{11}$/.test((personalNumber || '').replace(/\D/g, '')) ? personalNumber.replace(/\D/g, '') : personalNumber || undefined,
      birthDate: this.formatDate(line2.substring(0, 6)),
      sex: line2.substring(7, 8),
      expiryDate: this.formatDate(line2.substring(8, 14)),
      nationality: line2.substring(15, 18).replace(/</g, '').trim(),
      surname,
      givenName: ad,
      babaAdi: babaAdi || undefined,
      anaAdi: anaAdi || undefined,
    };
  }

  static _parseTD2(lines) {
    const line1 = (lines[0] || '').padEnd(36, '<').substring(0, 36);
    const line2 = (lines[1] || '').padEnd(36, '<').substring(0, 36);
    const nameBlock = line1.substring(5, 36);
    const nameParts = nameBlock.split('<<').map((s) => s.replace(/</g, ' ').trim());
    return {
      format: 'TD2',
      documentType: line1.substring(0, 2).replace(/</g, '').trim(),
      issuingCountry: line1.substring(2, 5).replace(/</g, '').trim(),
      surname: (nameParts[0] || '').trim(),
      givenName: (nameParts[1] || '').trim(),
      documentNumber: line2.substring(0, 9).replace(/</g, '').trim(),
      birthDate: this.formatDate(line2.substring(13, 19)),
      sex: line2.substring(19, 20),
      expiryDate: this.formatDate(line2.substring(21, 27)),
      nationality: line2.substring(10, 13).replace(/</g, '').trim(),
    };
  }

  static _parseTD3(lines) {
    const line1 = (lines[0] || '').padEnd(44, '<').substring(0, 44);
    const line2 = (lines[1] || '').padEnd(44, '<').substring(0, 44);
    const nameBlock = line1.substring(5, 44);
    const nameParts = nameBlock.split('<<').map((s) => s.replace(/</g, ' ').trim());
    return {
      format: 'TD3',
      documentType: line1.substring(0, 2).replace(/</g, '').trim(),
      issuingCountry: line1.substring(2, 5).replace(/</g, '').trim(),
      surname: (nameParts[0] || '').trim(),
      givenName: (nameParts[1] || '').trim(),
      documentNumber: line2.substring(0, 9).replace(/</g, '').trim(),
      birthDate: this.formatDate(line2.substring(13, 19)),
      sex: line2.substring(20, 21),
      expiryDate: this.formatDate(line2.substring(21, 27)),
      nationality: line2.substring(10, 13).replace(/</g, '').trim(),
    };
  }
}

/**
 * Backend /universal-mrz/read yanıtındaki parsed objesini MrzResultScreen payload formatına çevirir.
 */
export function universalParsedToPayload(parsed, rawMrz = '') {
  if (!parsed || parsed.format === 'UNKNOWN') return null;
  const docNo = parsed.personalNumber || parsed.documentNumber || '';
  const isTc = /^\d{11}$/.test(String(docNo).replace(/\D/g, ''));
  return {
    passportNumber: docNo,
    kimlikNo: isTc ? docNo : null,
    pasaportNo: !isTc ? docNo : null,
    documentNumber: parsed.documentNumber,
    surname: parsed.surname,
    soyad: parsed.surname,
    givenNames: parsed.givenName,
    ad: parsed.givenName,
    babaAdi: parsed.babaAdi ?? '',
    anaAdi: parsed.anaAdi ?? '',
    birthDate: parsed.birthDate,
    expiryDate: parsed.expiryDate,
    sonKullanma: parsed.expiryDate,
    nationality: parsed.nationality,
    uyruk: parsed.nationality,
    issuingCountry: parsed.issuingCountry,
    docType: parsed.format === 'TD1' ? 'ID' : 'PASSPORT',
    raw: rawMrz,
    checks: { ok: true },
  };
}
