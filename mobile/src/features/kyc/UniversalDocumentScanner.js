/**
 * Evrensel belge tarayıcı: profesyonel SDK (Regula) veya mevcut MRZ/OCR fallback.
 * Tüm dünya pasaportları, TC kimlik, ehliyet ve sürücü belgeleri için tek giriş noktası.
 */

import { isDocumentReaderAvailable, showScanner } from '../../services/documentReader';
import { parseMrz } from '../../lib/mrz';
import { logger } from '../../utils/logger';

/** Re-export for consumers that import only from UniversalDocumentScanner */
export { isDocumentReaderAvailable };

/**
 * Regula GraphQL / SDK ham sonuç tipi (alan adları SDK'dan gelir).
 * @typedef {Object} DocumentReaderResult
 * @property {Object} [graphqlResult]
 * @property {Object} [graphqlResult.document]
 * @property {Array<{ fieldName: string; value: string }>} [graphqlResult.document.fields]
 * @property {string} [graphqlResult.document.mrz]
 * @property {string} [graphqlResult.document.portrait] - base64
 */

/**
 * KBS Prime tarafında kullanılan birleşik belge verisi (MrzResultScreen / okutulan-belgeler uyumlu).
 * @typedef {Object} UniversalDocumentData
 * @property {string} [firstName]
 * @property {string} [givenNames]
 * @property {string} [ad]
 * @property {string} [lastName]
 * @property {string} [surname]
 * @property {string} [soyad]
 * @property {string} [documentNumber]
 * @property {string} [passportNumber]
 * @property {string} [belgeNo]
 * @property {string} [birthDate]   ISO YYYY-MM-DD
 * @property {string} [dogumTarihi]
 * @property {string} [expiryDate]
 * @property {string} [sonKullanma]
 * @property {string} [nationality]
 * @property {string} [uyruk]
 * @property {string} [gender]
 * @property {string} [sex]
 * @property {string} [birthPlace]
 * @property {string} [address]
 * @property {string} [mrz]
 * @property {string} [photoBase64]
 * @property {string} [documentType]  P | I | A | OTHER
 * @property {string} [issuingCountry]
 * @property {string} [tcNo]          Türk kimlik için
 * @property {string} [belgeTuru]     KİMLİK | PASAPORT
 * @property {{ ok: boolean; reason?: string }} [checks]
 * @property {string} [raw]           Ham MRZ (legacy path)
 */

const FIELD_MAP = [
  ['First Name', 'firstName'],
  ['Given Name', 'givenNames'],
  ['Given names', 'givenNames'],
  ['Surname', 'lastName'],
  ['Last Name', 'lastName'],
  ['Document Number', 'documentNumber'],
  ['Passport Number', 'documentNumber'],
  ['Date of Birth', 'birthDate'],
  ['Birth date', 'birthDate'],
  ['Nationality', 'nationality'],
  ['Sex', 'gender'],
  ['Gender', 'gender'],
  ['Place of Birth', 'birthPlace'],
  ['Address', 'address'],
  ['Expiry Date', 'expiryDate'],
  ['Date of Expiry', 'expiryDate'],
  ['Issuing State', 'issuingCountry'],
  ['Issuing Country', 'issuingCountry'],
];

/**
 * SDK (Regula) sonucunu KBS payload formatına çevirir.
 * @param {DocumentReaderResult} result - showScanner() dönüşü
 * @returns {UniversalDocumentData}
 */
export function parseDocumentResult(result) {
  const data = /** @type {UniversalDocumentData} */ ({
    firstName: '',
    givenNames: '',
    ad: '',
    lastName: '',
    surname: '',
    soyad: '',
    documentNumber: '',
    passportNumber: '',
    belgeNo: '',
    birthDate: '',
    dogumTarihi: '',
    expiryDate: '',
    sonKullanma: '',
    nationality: '',
    uyruk: '',
    gender: '',
    sex: '',
    birthPlace: '',
    address: '',
    mrz: '',
    photoBase64: '',
    documentType: 'OTHER',
    issuingCountry: '',
    tcNo: '',
    belgeTuru: '',
    checks: { ok: true },
    raw: '',
  });

  if (!result || typeof result !== 'object') return data;

  const doc = result?.graphqlResult?.document;
  if (!doc) {
    if (result?.mrz) {
      data.mrz = result.mrz;
      const parsed = parseMrz(result.mrz);
      return mergeMrzPayloadIntoUniversal(parsed, data);
    }
    return data;
  }

  const fields = doc.fields || [];
  for (const field of fields) {
    const name = field?.fieldName;
    const value = field?.value != null ? String(field.value).trim() : '';
    if (!name || !value) continue;
    for (const [key, dest] of FIELD_MAP) {
      if (name !== key) continue;
      if (dest === 'givenNames' || dest === 'firstName') {
        data.firstName = data.firstName || value;
        data.givenNames = data.givenNames || value;
        data.ad = data.ad || value;
      } else if (dest === 'lastName') {
        data.lastName = data.lastName || value;
        data.surname = data.surname || value;
        data.soyad = data.soyad || value;
      } else if (dest === 'documentNumber') {
        data.documentNumber = value;
        data.passportNumber = value;
        data.belgeNo = value;
      } else if (dest === 'birthDate') {
        data.birthDate = normalizeDateToISO(value);
        data.dogumTarihi = data.birthDate;
      } else if (dest === 'expiryDate') {
        data.expiryDate = normalizeDateToISO(value);
        data.sonKullanma = data.expiryDate;
      } else if (dest === 'gender') {
        data.gender = value;
        data.sex = value === 'M' || value === 'F' ? value : 'U';
      } else {
        data[dest] = value;
      }
      break;
    }
  }

  if (doc.mrz) {
    data.mrz = doc.mrz;
    const parsed = parseMrz(doc.mrz);
    mergeMrzPayloadIntoUniversal(parsed, data);
  }
  if (doc.portrait) data.photoBase64 = doc.portrait;

  data.documentType = data.documentType || (data.documentNumber && /^\d{11}$/.test(String(data.documentNumber).replace(/\D/g, '')) ? 'I' : 'P');
  data.belgeTuru = data.documentType === 'P' ? 'PASAPORT' : 'KİMLİK';
  if (data.documentNumber && /^\d{11}$/.test(String(data.documentNumber).replace(/\D/g, ''))) data.tcNo = data.documentNumber;
  data.checks = { ok: true };
  return data;
}

function normalizeDateToISO(value) {
  if (!value) return '';
  const d = value.replace(/\s/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split('.');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{6}$/.test(d)) {
    const yy = parseInt(d.slice(0, 2), 10);
    const yyyy = yy <= 30 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  }
  return value;
}

/**
 * parseMrz() çıktısını UniversalDocumentData ile birleştir (SDK'dan MRZ geldiğinde).
 * @param {import('../../lib/mrz/mrzTypes').MrzPayload & { belgeNo?: string; tcNo?: string; dogumTarihi?: string; sonKullanma?: string; uyruk?: string; soyad?: string; ad?: string; belgeTuru?: string }} parsed
 * @param {UniversalDocumentData} data
 * @returns {UniversalDocumentData}
 */
function mergeMrzPayloadIntoUniversal(parsed, data) {
  if (!parsed) return data;
  data.surname = data.surname || parsed.surname || parsed.soyad || '';
  data.soyad = data.soyad || parsed.soyad || parsed.surname || '';
  data.givenNames = data.givenNames || parsed.givenNames || parsed.ad || '';
  data.ad = data.ad || parsed.ad || parsed.givenNames || '';
  data.firstName = data.firstName || parsed.givenNames || parsed.ad || '';
  data.documentNumber = data.documentNumber || parsed.passportNumber || parsed.belgeNo || '';
  data.passportNumber = data.passportNumber || parsed.passportNumber || parsed.belgeNo || '';
  data.belgeNo = data.belgeNo || parsed.belgeNo || parsed.passportNumber || '';
  data.birthDate = data.birthDate || parsed.birthDate || parsed.dogumTarihi || '';
  data.dogumTarihi = data.dogumTarihi || parsed.dogumTarihi || parsed.birthDate || '';
  data.expiryDate = data.expiryDate || parsed.expiryDate || parsed.sonKullanma || '';
  data.sonKullanma = data.sonKullanma || parsed.sonKullanma || parsed.expiryDate || '';
  data.nationality = data.nationality || parsed.nationality || parsed.uyruk || '';
  data.uyruk = data.uyruk || parsed.uyruk || parsed.nationality || '';
  data.issuingCountry = data.issuingCountry || parsed.issuingCountry || '';
  data.sex = data.sex || parsed.sex || 'U';
  data.documentType = data.documentType || parsed.docType || 'OTHER';
  data.tcNo = data.tcNo || parsed.tcNo || '';
  data.raw = data.raw || parsed.raw || '';
  data.checks = parsed.checks ? { ok: parsed.checks.ok, reason: parsed.checks.reason } : data.checks;
  data.belgeTuru = parsed.belgeTuru || data.belgeTuru || (data.documentType === 'P' ? 'PASAPORT' : 'KİMLİK');
  return data;
}

/**
 * MrzResultScreen ve acceptAndNavigate için mevcut payload formatına uygun obje üretir.
 * @param {UniversalDocumentData} data
 * @returns {import('../../lib/mrz/mrzTypes').MrzPayload & { ad?: string; soyad?: string; belgeNo?: string; tcNo?: string; dogumTarihi?: string; sonKullanma?: string; uyruk?: string }}
 */
export function toMrzResultPayload(data) {
  if (!data) return null;
  return {
    docType: data.documentType === 'P' ? 'P' : data.documentType === 'I' || data.documentType === 'A' ? 'ID' : 'OTHER',
    issuingCountry: data.issuingCountry || data.nationality || '',
    surname: data.surname || data.soyad || data.lastName || '',
    givenNames: data.givenNames || data.ad || data.firstName || '',
    passportNumber: data.documentNumber || data.passportNumber || data.belgeNo || '',
    nationality: data.nationality || data.uyruk || '',
    birthDate: data.birthDate || data.dogumTarihi || '',
    sex: data.sex || 'U',
    expiryDate: data.expiryDate || data.sonKullanma || '',
    raw: data.mrz || data.raw || '',
    checks: data.checks || { ok: true },
    ad: data.ad || data.givenNames || data.firstName || '',
    soyad: data.soyad || data.surname || data.lastName || '',
    belgeNo: data.belgeNo || data.documentNumber || '',
    tcNo: data.tcNo || '',
    dogumTarihi: data.dogumTarihi || data.birthDate || '',
    sonKullanma: data.sonKullanma || data.expiryDate || '',
    uyruk: data.uyruk || data.nationality || '',
    belgeTuru: data.belgeTuru || '',
  };
}

/**
 * Profesyonel SDK ile tara. SDK yoksa veya hata/iptal olursa atar.
 * @param {{ language?: string; documentTypes?: string }} [options]
 * @returns {Promise<UniversalDocumentData>}
 */
export async function scanDocument(options = {}) {
  const result = await showScanner({
    language: options.language || 'tr',
    showHelpAnimation: true,
    documentTypes: options.documentTypes || 'All',
  });
  const parsed = parseDocumentResult(result);
  if (!parsed.documentNumber && !parsed.passportNumber && !parsed.belgeNo && !parsed.mrz) {
    throw new Error('Belge alanları okunamadı.');
  }
  return parsed;
}

/**
 * Önce profesyonel SDK dene; başarısız/iptal/yarı yoksa legacy MRZ kullanılmaz (çağıran mevcut kamera/galeri akışında kalır).
 * Başarıda KBS payload (MrzResult uyumlu) döner.
 * @param {{ language?: string }} [options]
 * @returns {Promise<UniversalDocumentData | null>} Başarıda veri; SDK yok veya iptal/hata da null (fallback için ekran aynen devam eder).
 */
export async function scanWithFallback(options = {}) {
  if (isDocumentReaderAvailable()) {
    try {
      const data = await scanDocument(options);
      logger.info('[UniversalDocument] SDK okuma başarılı');
      return data;
    } catch (e) {
      logger.warn('[UniversalDocument] SDK hatası, kamera/galeri kullanılacak', e?.message);
      return null;
    }
  }
  return null;
}
