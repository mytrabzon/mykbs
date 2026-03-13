/**
 * Belge verisi doğrulama: ICAO 9303 uyumluluk, tarih mantığı, çoklu kaynak karşılaştırma.
 */

import { checkDigit } from './mrz';

/**
 * ICAO 9303 uyumluluk ve mantıksal validasyon.
 * @param {{ mrz?: string; birthDate?: string; expiryDate?: string; documentNumber?: string }} data
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateICAO(data) {
  const errors = [];

  if (data?.mrz && typeof data.mrz === 'string') {
    const raw = data.mrz.replace(/\s/g, '').toUpperCase();
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length >= 2) {
      const l2 = lines[1].padEnd(44, '<');
      const docNum = l2.substring(0, 9).replace(/</g, '');
      const docCheck = l2[9];
      const birthRaw = l2.substring(13, 19);
      const birthCheck = l2[19];
      const expiryRaw = l2.substring(21, 27);
      const expiryCheck = l2[27];
      if (docNum && docCheck !== '<') {
        const expected = checkDigit(docNum);
        if (parseInt(docCheck, 10) !== expected) errors.push('DOCUMENT_NUMBER_CHECKSUM');
      }
      if (birthRaw && birthCheck !== '<') {
        if (parseInt(birthCheck, 10) !== checkDigit(birthRaw)) errors.push('BIRTH_DATE_CHECKSUM');
      }
      if (expiryRaw && expiryCheck !== '<') {
        if (parseInt(expiryCheck, 10) !== checkDigit(expiryRaw)) errors.push('EXPIRY_DATE_CHECKSUM');
      }
    }
  }

  const birth = data?.birthDate ? new Date(data.birthDate) : null;
  const expiry = data?.expiryDate ? new Date(data.expiryDate) : null;
  const now = new Date();

  if (expiry) {
    if (isNaN(expiry.getTime())) errors.push('INVALID_EXPIRY_DATE');
    else if (expiry < now) errors.push('DOCUMENT_EXPIRED');
  }
  if (birth) {
    if (isNaN(birth.getTime())) errors.push('INVALID_BIRTH_DATE');
    else if (birth > now) errors.push('BIRTH_DATE_FUTURE');
  }
  if (birth && expiry && !isNaN(birth.getTime()) && !isNaN(expiry.getTime()) && birth > expiry) {
    errors.push('INVALID_DATES');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * MRZ, görsel bölge ve NFC verilerini karşılaştır; tutarsızlıkları döndürür.
 * @param {{ firstName?: string; surname?: string; documentNumber?: string }} [mrzData]
 * @param {{ firstName?: string; surname?: string; documentNumber?: string }} [visualData]
 * @param {{ documentNumber?: string }} [nfcData]
 * @returns {{ match: boolean; inconsistencies: string[] }}
 */
export function crossValidate(mrzData, visualData, nfcData) {
  const inconsistencies = [];

  const norm = (s) => (s != null ? String(s).trim().toUpperCase() : '');

  if (mrzData && visualData) {
    const mFirst = norm(mrzData.firstName || mrzData.givenNames);
    const vFirst = norm(visualData.firstName || visualData.givenNames);
    if (mFirst && vFirst && mFirst !== vFirst) inconsistencies.push('FIRST_NAME_MISMATCH');
    const mLast = norm(mrzData.surname);
    const vLast = norm(visualData.surname);
    if (mLast && vLast && mLast !== vLast) inconsistencies.push('SURNAME_MISMATCH');
    const mDoc = norm(mrzData.documentNumber);
    const vDoc = norm(visualData.documentNumber);
    if (mDoc && vDoc && mDoc !== vDoc) inconsistencies.push('DOC_NUMBER_MISMATCH');
  }

  if (nfcData && mrzData) {
    const nDoc = norm(nfcData.documentNumber);
    const mDoc = norm(mrzData.documentNumber);
    if (nDoc && mDoc && nDoc !== mDoc) inconsistencies.push('DOC_NUMBER_MISMATCH');
  }

  if (nfcData && visualData) {
    const nDoc = norm(nfcData.documentNumber);
    const vDoc = norm(visualData.documentNumber);
    if (nDoc && vDoc && nDoc !== vDoc) inconsistencies.push('DOC_NUMBER_MISMATCH');
  }

  return {
    match: inconsistencies.length === 0,
    inconsistencies,
  };
}
