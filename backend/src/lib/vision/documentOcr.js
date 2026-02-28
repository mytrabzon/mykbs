/**
 * Full-document OCR for TR ID / DL front: Tesseract + parseIdentityDocument.
 * Used by POST /scan/doc/parse.
 */

const Tesseract = require('tesseract.js');
const { validateTC, normalizeDigits } = require('./tr_common');

/**
 * Parse OCR text for identity document (TR kimlik / genel ön yüz): ad, soyad, TCKN, doğum tarihi, uyruk.
 */
function parseIdentityDocument(text) {
  const raw = (text || '').replace(/\r\n/g, '\n');
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

  const result = {
    ad: '',
    soyad: '',
    kimlikNo: null,
    pasaportNo: null,
    dogumTarihi: null,
    uyruk: 'TÜRK',
    seriNo: null,
    belgeNo: null,
    gecerlilik: null,
    sinif: null,
  };

  const kimlikCandidates = [];
  const pasaportCandidates = [];
  const tarihCandidates = [];

  for (const line of lines) {
    const normalized = normalizeDigits(line);
    const tc11 = line.match(/\b\d{11}\b/g) || (normalized && normalized.match(/\d{11}/g));
    if (tc11) {
      for (const cand of tc11) {
        const cleaned = String(cand).replace(/[O]/g, '0').replace(/[lI]/g, '1');
        if (/^\d{11}$/.test(cleaned) && validateTC(cleaned)) {
          result.kimlikNo = cleaned;
          break;
        }
        kimlikCandidates.push(cleaned);
      }
    }

    if (!result.kimlikNo && /[A-Z]{1,2}\d{6,9}/.test(line)) {
      const m = line.match(/\b([A-Z]{1,2}\d{6,9})\b/g);
      if (m) pasaportCandidates.push(...m);
    }

    const tarihDDMMYYYY = line.match(/\b(\d{2})[./\-](\d{2})[./\-](\d{4})\b/g);
    if (tarihDDMMYYYY) {
      for (const t of tarihDDMMYYYY) {
        const normalizedTarih = t.replace(/\//g, '.').replace(/-/g, '.');
        const match = normalizedTarih.match(/(\d{2})[.](\d{2})[.](\d{4})/);
        if (match) {
          const y = parseInt(match[3], 10);
          if (y >= 1920 && y <= 2015) tarihCandidates.push(normalizedTarih);
        }
      }
    }
  }

  if (!result.kimlikNo && kimlikCandidates.length > 0) {
    const valid = kimlikCandidates.find((c) => /^\d{11}$/.test(c) && validateTC(c));
    if (valid) result.kimlikNo = valid;
    else result.kimlikNo = kimlikCandidates[0].replace(/\D/g, '').slice(0, 11);
  }
  if (!result.kimlikNo && pasaportCandidates.length > 0) {
    result.pasaportNo = pasaportCandidates[0];
  }
  if (tarihCandidates.length > 0) {
    result.dogumTarihi = tarihCandidates[0];
  }

  const uyrukRegex = /\b(?:TÜRK|TURK|TUR|T\.C\.|TURKEY|TURKIYE)\b/i;
  for (const line of lines) {
    if (uyrukRegex.test(line)) {
      result.uyruk = 'TÜRK';
      break;
    }
  }

  const nameLike = /^[A-Za-zÇĞİÖŞÜçğıöşü\s\-]+$/;
  for (const line of lines) {
    if (line.length > 4 && nameLike.test(line) && !/\d{2,}/.test(line)) {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        result.ad = parts[0].trim();
        result.soyad = parts.slice(1).join(' ').trim();
        break;
      }
    }
  }

  return result;
}

/**
 * Run OCR on image path and return parsed identity document.
 */
async function runDocumentOcr(imagePath) {
  const { data: { text } } = await Tesseract.recognize(imagePath, 'tur+eng', { logger: () => {} });
  return parseIdentityDocument(text);
}

module.exports = {
  parseIdentityDocument,
  runDocumentOcr,
};
