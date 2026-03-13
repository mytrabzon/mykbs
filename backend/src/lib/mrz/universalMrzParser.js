/**
 * KBS Prime - Evrensel MRZ Parser (Sıfırdan, özgün)
 * TD1 (T.C. Kimlik, bazı ülke kimlikleri), TD2 (vize, ehliyet), TD3 (pasaport)
 * Hiçbir dış MRZ SDK kullanılmaz.
 */

class UniversalMrzParser {
  /** Format otomatik algılama: satır sayısı ve uzunluk. */
  static detectFormat(mrzText) {
    const lines = mrzText
      .trim()
      .split(/\r\n|\r|\n/)
      .map((l) => l.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, ''))
      .filter((l) => l.length > 20);

    if (lines.length === 3 && lines[0].length >= 28 && lines[0].length <= 30) {
      return 'TD1';
    }
    if (lines.length === 2 && lines[0].length >= 34 && lines[0].length <= 36) {
      return 'TD2';
    }
    if (lines.length === 2 && lines[0].length >= 42 && lines[0].length <= 44) {
      return 'TD3';
    }
    // Tek blok (OCR birleşik): uzunluğa göre
    const one = (mrzText || '').replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
    if (one.length >= 86 && one.length <= 94 && (one[0] === 'I' || one[0] === 'A')) {
      return 'TD1';
    }
    if (one.length >= 70 && one.length <= 74) {
      return 'TD2';
    }
    if (one.length >= 80 && one.length <= 96 && one[0] === 'P') {
      return 'TD3';
    }
    return 'UNKNOWN';
  }

  /** Tarih YYMMDD -> YYYY-MM-DD (yıl 00-29 = 20xx, 30-99 = 19xx). */
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

  /** TD1: 3 satır x 30 karakter (T.C. Kimlik kartı). */
  static parseTD1(lines) {
    const line1 = (lines[0] || '').padEnd(30, '<').substring(0, 30);
    const line2 = (lines[1] || '').padEnd(30, '<').substring(0, 30);
    const line3 = (lines[2] || '').padEnd(30, '<').substring(0, 30);

    const nameParts = line3.split(/<+/).map((s) => s.replace(/</g, ' ').trim()).filter(Boolean);
    const surname = (nameParts[0] || '').trim();
    const givenName = (nameParts.slice(1).join(' ') || '').trim();
    const personalNumber = line2.substring(18, 29).replace(/</g, '').trim() || null;

    return {
      format: 'TD1',
      documentType: line1.substring(0, 2).replace(/</g, '').trim(),
      issuingCountry: line1.substring(2, 5).replace(/</g, '').trim(),
      documentNumber: line1.substring(5, 14).replace(/</g, '').trim(),
      personalNumber: /^\d{11}$/.test((personalNumber || '').replace(/\D/g, '')) ? personalNumber.replace(/\D/g, '') : personalNumber || undefined,
      birthDate: this.formatDate(line2.substring(0, 6)),
      sex: line2.substring(7, 8) === 'M' || line2.substring(7, 8) === 'F' ? line2.substring(7, 8) : line2.substring(7, 8) === '<' ? 'U' : undefined,
      expiryDate: this.formatDate(line2.substring(8, 14)),
      nationality: line2.substring(15, 18).replace(/</g, '').trim(),
      surname,
      givenName,
    };
  }

  /** TD2: 2 satır x 36 karakter (vize, ehliyet, ikamet). */
  static parseTD2(lines) {
    const line1 = (lines[0] || '').padEnd(36, '<').substring(0, 36);
    const line2 = (lines[1] || '').padEnd(36, '<').substring(0, 36);

    const nameBlock = line1.substring(5, 36);
    const nameParts = nameBlock.split('<<').map((s) => s.replace(/</g, ' ').trim());
    const surname = (nameParts[0] || '').trim();
    const givenName = (nameParts[1] || '').trim();

    return {
      format: 'TD2',
      documentType: line1.substring(0, 2).replace(/</g, '').trim(),
      issuingCountry: line1.substring(2, 5).replace(/</g, '').trim(),
      surname,
      givenName,
      documentNumber: line2.substring(0, 9).replace(/</g, '').trim(),
      birthDate: this.formatDate(line2.substring(13, 19)),
      sex: line2.substring(19, 20) === 'M' || line2.substring(19, 20) === 'F' ? line2.substring(19, 20) : line2.substring(19, 20) === '<' ? 'U' : undefined,
      expiryDate: this.formatDate(line2.substring(21, 27)),
      nationality: line2.substring(10, 13).replace(/</g, '').trim(),
    };
  }

  /** TD3: 2 satır x 44 karakter (pasaport). */
  static parseTD3(lines) {
    const line1 = (lines[0] || '').padEnd(44, '<').substring(0, 44);
    const line2 = (lines[1] || '').padEnd(44, '<').substring(0, 44);

    const nameBlock = line1.substring(5, 44);
    const nameParts = nameBlock.split('<<').map((s) => s.replace(/</g, ' ').trim());
    const surname = (nameParts[0] || '').trim();
    const givenName = (nameParts[1] || '').trim();

    return {
      format: 'TD3',
      documentType: line1.substring(0, 2).replace(/</g, '').trim(),
      issuingCountry: line1.substring(2, 5).replace(/</g, '').trim(),
      surname,
      givenName,
      documentNumber: line2.substring(0, 9).replace(/</g, '').trim(),
      birthDate: this.formatDate(line2.substring(13, 19)),
      sex: line2.substring(20, 21) === 'M' || line2.substring(20, 21) === 'F' ? line2.substring(20, 21) : line2.substring(20, 21) === '<' ? 'U' : undefined,
      expiryDate: this.formatDate(line2.substring(21, 27)),
      nationality: line2.substring(10, 13).replace(/</g, '').trim(),
    };
  }

  /** Ham metni temizle: sadece MRZ karakterleri, büyük harf. */
  static cleanMrz(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[^A-Za-z0-9<>\n]/g, '')
      .toUpperCase();
  }

  /** Tek blok OCR çıktısını satırlara böl. */
  static linesFromRaw(cleaned) {
    const one = cleaned.replace(/\n/g, '').replace(/\s/g, '');
    const lines = cleaned.split(/\n/).map((l) => l.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, '')).filter((l) => l.length > 20);

    if (lines.length >= 2) return lines;

    if (one.length >= 86 && one.length <= 94) {
      return [one.slice(0, 30).padEnd(30, '<'), one.slice(30, 60).padEnd(30, '<'), one.slice(60).padEnd(30, '<')];
    }
    if (one.length >= 80 && one.length <= 96) {
      return [one.slice(0, 44).padEnd(44, '<'), one.slice(44).padEnd(44, '<')];
    }
    if (one.length >= 70 && one.length <= 74) {
      return [one.slice(0, 36).padEnd(36, '<'), one.slice(36).padEnd(36, '<')];
    }
    return lines;
  }

  /** Ana parse: temizle -> format algıla -> ilgili parser. */
  static parse(mrzText) {
    const cleaned = this.cleanMrz(mrzText);
    const lines = this.linesFromRaw(cleaned);
    if (lines.length < 2) {
      return { format: 'UNKNOWN', raw: mrzText };
    }

    const format = this.detectFormat(cleaned);
    switch (format) {
      case 'TD1':
        return this.parseTD1(lines);
      case 'TD2':
        return this.parseTD2(lines);
      case 'TD3':
        return this.parseTD3(lines);
      default:
        return { format: 'UNKNOWN', raw: mrzText };
    }
  }
}

module.exports = { UniversalMrzParser };
