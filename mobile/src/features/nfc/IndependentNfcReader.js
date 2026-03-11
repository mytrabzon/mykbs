/**
 * NFC bağımsız okuyucu — ID kartı / pasaport çipini oku.
 * Kimlik kartı: BAC anahtarı (son MRZ) varsa NfcPassportReader ile oku; yoksa doğrudan GET DATA dene.
 */
import { useState, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger';

let NfcManager = null;
let NfcTech = null;
try {
  const pkg = require('react-native-nfc-manager');
  NfcManager = pkg.default;
  NfcTech = pkg.NfcTech;
} catch (e) {
  logger.warn('IndependentNfcReader: react-native-nfc-manager yok', e?.message);
}

let NfcPassportReader = null;
try {
  NfcPassportReader = require('react-native-nfc-passport-reader').default;
} catch (_) {}

async function getLastMrzForBac() {
  try {
    const { getLastMrzForBac: getBac } = require('../../utils/lastMrzForBac');
    return await getBac();
  } catch (_) {
    return null;
  }
}

function mapPassportReaderResultToPayload(r) {
  if (!r) return null;
  const birth = (r.birthDate || '').trim();
  const dogumTarihi = birth.includes('-') ? birth.split('-').reverse().join('.') : birth;
  const docNo = (r.identityNo || r.documentNo || '').trim();
  const isTc = /^\d{11}$/.test(docNo);
  return {
    type: 'id_card',
    ad: (r.firstName || '').trim(),
    soyad: (r.lastName || '').trim(),
    kimlikNo: isTc ? docNo : null,
    pasaportNo: !isTc ? docNo : null,
    dogumTarihi: dogumTarihi || null,
    uyruk: (r.nationality || 'TÜRK').trim(),
    cinsiyet: r.gender || null,
    sonKullanma: r.expiryDate ? (r.expiryDate.includes('-') ? r.expiryDate.split('-').reverse().join('.') : r.expiryDate) : null,
    chipPhotoBase64: r.originalFacePhoto || null,
    dogumYeri: r.placeOfBirth || null,
    ikametAdresi: null,
  };
}

/** iOS'ta NfcTech.IsoDep bazen tanımsız; IsoDep → NfcA → Ndef fallback (CheckInScreen ile aynı). */
function getNfcTechForRequest() {
  if (!NfcTech) return null;
  return NfcTech.IsoDep ?? NfcTech.NfcA ?? NfcTech.Ndef ?? null;
}

// eMRTD / eID AID'leri (ICAO 9303)
const PASSPORT_AID = [0xa0, 0x00, 0x00, 0x02, 0x47, 0x20, 0x01];
const ID_CARD_AID = [0xa0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01];

function buildSelectByAid(aid) {
  return [0x00, 0xa4, 0x04, 0x0c, aid.length, ...aid];
}

function isSuccessResponse(bytes) {
  if (!bytes || !Array.isArray(bytes)) return false;
  const len = bytes.length;
  return len >= 2 && bytes[len - 2] === 0x90 && bytes[len - 1] === 0x00;
}

function bytesToHex(arr) {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

/**
 * APDU gönder; react-native-nfc-manager transceive array kabul eder.
 * @param {number[]} command
 * @returns {Promise<number[]>}
 */
async function transceive(command) {
  if (!NfcManager || typeof NfcManager.transceive !== 'function') {
    throw new Error('NFC transceive desteklenmiyor');
  }
  const response = await NfcManager.transceive(command);
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && response.byteLength !== undefined) {
    return Array.from(new Uint8Array(response));
  }
  return [];
}

/**
 * Belge tipini algıla: önce kimlik AID, sonra pasaport AID dene.
 */
async function detectDocumentType() {
  try {
    const selectId = buildSelectByAid(ID_CARD_AID);
    const resId = await transceive(selectId);
    if (isSuccessResponse(resId)) {
      logger.info('[IndependentNfc] Belge tipi: id_card');
      return 'id_card';
    }
  } catch (_) {}

  try {
    const selectPass = buildSelectByAid(PASSPORT_AID);
    const resPass = await transceive(selectPass);
    if (isSuccessResponse(resPass)) {
      logger.info('[IndependentNfc] Belge tipi: passport');
      return 'passport';
    }
  } catch (_) {}

  return 'unknown';
}

/**
 * Pasaport MRZ olmadan: GET CHALLENGE dene; BAC olmadan çip verisi alınamaz.
 * Varsayılan anahtarlar gerçek pasaportlarda işe yaramaz; fallback döndür.
 */
async function readPassportWithoutMRZ() {
  try {
    const GET_CHALLENGE = [0x00, 0x84, 0x00, 0x00, 0x08];
    await transceive(GET_CHALLENGE);
  } catch (e) {
    logger.warn('[IndependentNfc] Pasaport GET CHALLENGE hatası', e?.message);
  }
  throw new Error('Pasaport çipi MRZ ile açılmalı. MRZ kamerayı kullanın.');
}

/**
 * Kimlik kartı: DG1/DG2 okumayı dene (eMRTD GET DATA).
 * Türk kimlik yapısı farklı olabilir; ortak eMRTD tag'leri kullanıyoruz.
 */
async function readIDCard() {
  const { readDG1, readDG2, readDG11, parseDG1ToPayload, extractFieldFromTLV } = require('./IdCardReader');
  const dg1 = await readDG1(transceive);
  const payload = parseDG1ToPayload(dg1);
  let chipPhotoBase64 = null;
  try {
    const dg2 = await readDG2(transceive);
    if (dg2 && dg2.length > 0) chipPhotoBase64 = bytesToBase64(dg2);
  } catch (_) {}
  let dogumYeri = null;
  let ikametAdresi = null;
  try {
    const dg11 = await readDG11(transceive);
    if (dg11 && dg11.length > 0) {
      dogumYeri = extractFieldFromTLV(dg11, 0x1c);
      ikametAdresi = extractFieldFromTLV(dg11, 0x1d);
    }
  } catch (_) {}
  return {
    type: 'id_card',
    ad: payload.ad || '',
    soyad: payload.soyad || '',
    kimlikNo: payload.kimlikNo || null,
    pasaportNo: payload.pasaportNo || null,
    dogumTarihi: payload.dogumTarihi || null,
    uyruk: payload.uyruk || 'TÜRK',
    cinsiyet: payload.cinsiyet || null,
    sonKullanma: payload.sonKullanma || null,
    chipPhotoBase64,
    dogumYeri: dogumYeri || null,
    ikametAdresi: ikametAdresi || null,
  };
}

function bytesToBase64(arr) {
  if (!arr || !Array.isArray(arr)) return null;
  try {
    if (typeof global !== 'undefined' && global.Buffer) {
      return global.Buffer.from(arr).toString('base64');
    }
    const binary = arr.map((b) => String.fromCharCode(b & 0xff)).join('');
    return typeof btoa !== 'undefined' ? btoa(binary) : null;
  } catch {
    return null;
  }
}

/**
 * NFC'yi MRZ'sız doğrudan oku.
 * Önce IsoDep ile bağlan, belge tipini algıla, sonra kimlik/pasaport oku.
 */
export function useIndependentNfcReader() {
  const [isReading, setIsReading] = useState(false);
  const [progress, setProgress] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const techRequestedRef = useRef(false);

  const closeNfc = useCallback(() => {
    if (!NfcManager) return;
    try {
      if (NfcManager.cancelTechnologyRequest) {
        NfcManager.cancelTechnologyRequest();
      } else if (NfcManager.closeTechnology) {
        NfcManager.closeTechnology();
      }
    } catch (_) {}
    techRequestedRef.current = false;
  }, []);

  const readNfcDirect = useCallback(async () => {
    const tech = getNfcTechForRequest();
    if (!NfcManager || !tech) {
      return { success: false, error: 'NFC desteklenmiyor', fallback: 'MRZ' };
    }

    setIsReading(true);
    setProgress('NFC başlatılıyor...');
    techRequestedRef.current = false;
    setLastResult(null);

    try {
      if (typeof NfcManager.start === 'function') {
        await NfcManager.start();
      }
      try {
        if (typeof NfcManager.isEnabled === 'function') {
          const enabled = await NfcManager.isEnabled();
          if (enabled === false) {
            return { success: false, error: 'NFC kapalı. Ayarlardan NFC\'yi açın.', fallback: 'MRZ' };
          }
        }
      } catch (_) {
        // iOS'ta isEnabled bazen atar veya desteklenmez; okumayı dene
      }

      // BAC anahtarı (son MRZ) varsa önce NfcPassportReader kullan — tek oturumda algıla + oku, "algılanmadı" önlenir
      const bacKey = await getLastMrzForBac();
      if (NfcPassportReader && bacKey?.documentNo && bacKey?.birthDate && bacKey?.expiryDate) {
        setProgress('Türk kimliğini telefonun arkasına yaklaştırın ve sabit tutun...');
        try {
          const nfcResult = await NfcPassportReader.startReading({
            bacKey: {
              documentNo: bacKey.documentNo,
              birthDate: bacKey.birthDate,
              expiryDate: bacKey.expiryDate,
            },
          });
          const result = mapPassportReaderResultToPayload(nfcResult);
          if (result && (result.ad || result.soyad || result.kimlikNo || result.pasaportNo)) {
            setLastResult(result);
            return { success: true, data: result };
          }
        } catch (bacErr) {
          if ((bacErr?.message || '').includes('cancel')) {
            return { success: false, error: 'Okuma iptal edildi.', fallback: 'MRZ' };
          }
          logger.warn('[IndependentNfc] NfcPassportReader hatası', bacErr?.message);
          const msg = bacErr?.message || '';
          const notDetected = /algılanmadı|not found|tag|timeout|connection/i.test(msg);
          return {
            success: false,
            error: notDetected
              ? 'Kart algılanmadı. Kimliği telefonun arkasına tam yaslayıp sabit tutun, tekrar deneyin.'
              : 'Kimlik okunamadı. MRZ sekmesinden kartı okutup tekrar deneyin.',
            fallback: 'MRZ',
          };
        }
      }

      setProgress('Belgeyi telefonun arkasına yaklaştırın...');
      await NfcManager.requestTechnology(tech);
      techRequestedRef.current = true;

      setProgress('Belge tipi algılanıyor...');
      const docType = await detectDocumentType();

      let result = null;

      if (docType === 'id_card') {
        setProgress('Kimlik kartı okunuyor...');
        try {
          result = await readIDCard();
          setLastResult(result);
          return { success: true, data: result };
        } catch (idErr) {
          logger.warn('[IndependentNfc] Kimlik okuma hatası', idErr?.message);
          const sw = (idErr?.message || '').match(/69 82|6982/);
          return {
            success: false,
            error: sw
              ? 'Kimlik çipi MRZ ile açılır. Önce MRZ sekmesinden kartı okutun, sonra tekrar NFC deneyin.'
              : 'Kimlik çipi okunamadı. MRZ sekmesinden kartı okutup tekrar deneyin.',
            fallback: 'MRZ',
          };
        }
      }

      if (docType === 'passport') {
        return { success: false, error: 'Pasaport çipi MRZ ile açılır. Önce MRZ kamerayı kullanın.', fallback: 'MRZ' };
      }

      setProgress('Belge tanınamadı.');
      return { success: false, error: 'Çip tanınamadı. Türk kimlik kartı veya MRZ kullanın.', fallback: 'MRZ' };
    } catch (error) {
      const msg = error?.message || '';
      logger.warn('[IndependentNfc] Okuma hatası', msg);
      let userMsg = msg;
      if (msg.includes('cancelled') || msg.includes('Cancel')) userMsg = 'Okuma iptal edildi.';
      else if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('algılanmadı') || /tag.*not|not.*found|connection.*lost/i.test(msg)) userMsg = 'Kart algılanmadı. Kimliği telefonun arkasına tam yaslayıp sabit tutun, tekrar deneyin.';
      else if (msg.includes('tag') || msg.includes('lost')) userMsg = 'Bağlantı koptu. Kimliği sabit tutup tekrar deneyin.';
      else if (msg.includes('IsoDep') || msg.includes('Tech')) userMsg = 'NFC bağlantısı kurulamadı. MRZ sekmesinden kartı okutup tekrar NFC deneyin.';
      return {
        success: false,
        error: userMsg,
        fallback: 'MRZ',
      };
    } finally {
      if (techRequestedRef.current) closeNfc();
      setIsReading(false);
      setProgress('');
    }
  }, [closeNfc]);

  return {
    readNfcDirect,
    isReading,
    progress,
    lastResult,
    closeNfc,
    isSupported: !!(NfcManager && getNfcTechForRequest()),
  };
}
