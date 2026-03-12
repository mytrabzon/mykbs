/**
 * NFC bağımsız okuyucu — e‑pasaport ve eID (T.C. kimlik vb.) çiplerini oku.
 * Önce NfcFullCardReader ile BAC + tüm veri grupları (DG1/DG2/DG7/DG11 vb.) tek seferde okunur;
 * başarısızsa raw IsoDep ile belge tipi algılanıp DG1/DG2/DG11 manuel okunur.
 */
import { useState, useRef, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { readAllDataWhenCardNear, mapNativeResultToFullPayload } from './NfcFullCardReader';

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

function getDefaultBacKeys() {
  try {
    const { getDefaultBacKeysForTurkishId } = require('../../utils/lastMrzForBac');
    return getDefaultBacKeysForTurkishId();
  } catch (_) {
    return [];
  }
}

/** Native sonucunu uygulama payload'ına map eder (NfcFullCardReader ile uyumlu). */
function mapPassportReaderResultToPayload(r) {
  const mapped = mapNativeResultToFullPayload(r);
  if (mapped && mapped.raw) {
    const { raw, ...rest } = mapped;
    return rest;
  }
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
    chipSignatureBase64: r.signatureImage || r.originalSignature || null,
    dogumYeri: r.placeOfBirth || null,
    ikametAdresi: r.address || r.placeOfResidence || null,
  };
}

/** iOS'ta NfcTech.IsoDep bazen tanımsız; IsoDep → NfcA → Ndef fallback (CheckInScreen ile aynı). */
function getNfcTechForRequest() {
  if (!NfcTech) return null;
  return NfcTech.IsoDep ?? NfcTech.NfcA ?? NfcTech.Ndef ?? null;
}

// eMRTD / eID AID'leri (ICAO 9303). Türk kimlik kartı da bu AID'i kullanır.
const PASSPORT_AID = [0xa0, 0x00, 0x00, 0x02, 0x47, 0x20, 0x01];
const ID_CARD_AID = [0xa0, 0x00, 0x00, 0x02, 0x47, 0x10, 0x01];
// Bazı kartlar 6 byte AID ile seçilir (son 0x01 olmadan)
const ID_CARD_AID_SHORT = [0xa0, 0x00, 0x00, 0x02, 0x47, 0x10];

function buildSelectByAid(aid) {
  return [0x00, 0xa4, 0x04, 0x0c, aid.length, ...aid];
}

/** SELECT yanıtının son 2 byte'ı (SW1 SW2); hata ayıklama için loglanır */
function getStatusWords(bytes) {
  if (!bytes || !Array.isArray(bytes) || bytes.length < 2) return null;
  const sw1 = bytes[bytes.length - 2];
  const sw2 = bytes[bytes.length - 1];
  return { sw1, sw2, hex: `${(sw1 & 0xff).toString(16).padStart(2, '0')} ${(sw2 & 0xff).toString(16).padStart(2, '0')}` };
}

function isSuccessResponse(bytes) {
  if (!bytes || !Array.isArray(bytes)) return false;
  const len = bytes.length;
  if (len < 2) return false;
  const sw1 = bytes[len - 2];
  const sw2 = bytes[len - 1];
  // 90 00 = success; 61 xx = success, xx bytes available (GET RESPONSE) — birçok eID çipi 61 xx döner
  return (sw1 === 0x90 && sw2 === 0x00) || (sw1 === 0x61);
}

function bytesToHex(arr) {
  if (!arr || !Array.isArray(arr)) return '';
  return arr.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
}

/**
 * APDU gönder. Android'de NfcManager.transceive, iOS'ta isoDepHandler.transceive kullanılır (iOS'ta transceive doğrudan yok).
 * @param {number[]} command
 * @returns {Promise<number[]>}
 */
async function transceive(command) {
  if (!NfcManager) throw new Error('NFC transceive desteklenmiyor');
  let response;
  if (typeof NfcManager.transceive === 'function') {
    response = await NfcManager.transceive(command);
  } else if (NfcManager.isoDepHandler && typeof NfcManager.isoDepHandler.transceive === 'function') {
    response = await NfcManager.isoDepHandler.transceive(command);
  } else {
    throw new Error('NFC transceive desteklenmiyor');
  }
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object' && response.byteLength !== undefined) {
    return Array.from(new Uint8Array(response));
  }
  return [];
}

/** Master File (3F 00) seçimi — bazı eID çiplerinde uygulama seçmeden önce gerekebilir */
async function selectMF() {
  try {
    const SELECT_MF = [0x00, 0xa4, 0x00, 0x04, 0x02, 0x3f, 0x00];
    await transceive(SELECT_MF);
  } catch (_) {}
}

/**
 * Belge tipini algıla: önce kimlik AID, sonra pasaport AID dene.
 * Türk kimlik: A0 00 00 02 47 10 01 (veya 47 10 kısa). Bazı çipler 90 00 yerine 61 xx döner; ikisi de başarı sayılır.
 */
async function detectDocumentType() {
  const tried = [];

  await selectMF();

  // 1) Kimlik AID (7 byte) — standart eID
  try {
    const selectId = buildSelectByAid(ID_CARD_AID);
    const resId = await transceive(selectId);
    const statusId = getStatusWords(resId);
    tried.push({ name: 'id_card', ...statusId });
    if (isSuccessResponse(resId)) {
      logger.info('[NFC] Belge tipi: id_card', statusId);
      return 'id_card';
    }
  } catch (e) {
    tried.push({ name: 'id_card', error: e?.message });
  }

  // 2) Kimlik AID kısa (6 byte) — bazı Türk kartları
  try {
    const selectIdShort = buildSelectByAid(ID_CARD_AID_SHORT);
    const resIdShort = await transceive(selectIdShort);
    const statusShort = getStatusWords(resIdShort);
    tried.push({ name: 'id_card_short', ...statusShort });
    if (isSuccessResponse(resIdShort)) {
      logger.info('[NFC] Belge tipi: id_card (short AID)', statusShort);
      return 'id_card';
    }
  } catch (e) {
    tried.push({ name: 'id_card_short', error: e?.message });
  }

  // 3) Pasaport AID
  try {
    const selectPass = buildSelectByAid(PASSPORT_AID);
    const resPass = await transceive(selectPass);
    const statusPass = getStatusWords(resPass);
    tried.push({ name: 'passport', ...statusPass });
    if (isSuccessResponse(resPass)) {
      logger.info('[NFC] Belge tipi: passport', statusPass);
      return 'passport';
    }
  } catch (e) {
    tried.push({ name: 'passport', error: e?.message });
  }

  logger.warn('[NFC] Belge tipi algılanamadı; çip yanıtları', tried);
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
  throw new Error('NFC okunamadı, tekrar dener misiniz?');
}

/**
 * Kimlik kartı: DG1/DG2 okumayı dene (eMRTD GET DATA).
 * Türk kimlik yapısı farklı olabilir; ortak eMRTD tag'leri kullanıyoruz.
 */
async function readIDCard() {
  const { readDG1, readDG2, readDG7, readDG11, parseDG1ToPayload, extractFieldFromTLV, extractFaceImageFromDG2, extractSignatureFromDG7 } = require('./IdCardReader');
  const dg1 = await readDG1(transceive);
  logger.info('[NFC] DG1 okundu', { length: dg1?.length ?? 0 });
  const payload = parseDG1ToPayload(dg1);
  logger.info('[NFC] DG1 parse edildi', { ad: payload?.ad, soyad: payload?.soyad, kimlikNo: payload?.kimlikNo, pasaportNo: payload?.pasaportNo });
  let chipPhotoBase64 = null;
  try {
    const dg2 = await readDG2(transceive);
    if (dg2 && dg2.length > 0) {
      const jpegBytes = extractFaceImageFromDG2(dg2);
      if (jpegBytes && jpegBytes.length > 0) {
        chipPhotoBase64 = bytesToBase64(jpegBytes);
        logger.info('[NFC] DG2 (foto) JPEG çıkarıldı', { length: jpegBytes.length, hasBase64: !!chipPhotoBase64 });
      } else {
        chipPhotoBase64 = bytesToBase64(dg2);
        logger.info('[NFC] DG2 (foto) ham okundu', { length: dg2.length, hasBase64: !!chipPhotoBase64 });
      }
    }
  } catch (_) {}
  let chipSignatureBase64 = null;
  try {
    const dg7 = await readDG7(transceive);
    if (dg7 && dg7.length > 0) {
      const sigBytes = extractSignatureFromDG7(dg7);
      if (sigBytes && sigBytes.length > 0) chipSignatureBase64 = bytesToBase64(sigBytes);
    }
  } catch (_) {}
  let dogumYeri = null;
  let ikametAdresi = null;
  try {
    const dg11 = await readDG11(transceive);
    if (dg11 && dg11.length > 0) {
      dogumYeri = extractFieldFromTLV(dg11, 0x1c);
      ikametAdresi = extractFieldFromTLV(dg11, 0x1d);
      logger.info('[NFC] DG11 okundu', { length: dg11.length, dogumYeri: !!dogumYeri, ikametAdresi: !!ikametAdresi });
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
    chipSignatureBase64: chipSignatureBase64 || null,
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

  const readNfcDirect = useCallback(async (options = {}) => {
    const tech = getNfcTechForRequest();
    logger.info('[NFC] readNfcDirect çağrıldı', { hasNfcManager: !!NfcManager, tech: tech ?? 'yok' });
    if (!NfcManager || !tech) {
      logger.warn('[NFC] NFC desteklenmiyor, çıkış');
      return { success: false, error: 'NFC desteklenmiyor', fallback: 'MRZ' };
    }

    setIsReading(true);
    setProgress('NFC başlatılıyor...');
    techRequestedRef.current = false;
    setLastResult(null);

    try {
      if (typeof NfcManager.start === 'function') {
        await NfcManager.start();
        logger.info('[NFC] NfcManager.start() tamamlandı');
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

      // Önce tam okuyucu: kart yaklaştığı anda BAC + tüm DG'ler (foto, imza, adres vb.) tek seferde
      const extraKeys = options?.extraKeys ?? [];
      const fullResult = await readAllDataWhenCardNear({
        includeImages: true,
        onProgress: (msg) => setProgress(msg),
        extraKeys: extraKeys.length > 0 ? extraKeys : undefined,
      });
      if (fullResult.success && fullResult.data) {
        const data = fullResult.data;
        if (data.raw) {
          const { raw, ...rest } = data;
          setLastResult(rest);
          return { success: true, data: rest };
        }
        setLastResult(data);
        return { success: true, data };
      }
      if (fullResult.error && (fullResult.error.includes('iptal') || fullResult.error.includes('cancel'))) {
        return { success: false, error: fullResult.error, fallback: null };
      }
      if (fullResult.error && fullResult.fallback !== 'MRZ') {
        return { success: false, error: fullResult.error, fallback: null };
      }

      setProgress('Kimlik veya pasaportu telefonun arkasına yaklaştırın...');
      logger.info('[NFC] requestTechnology çağrılıyor', { tech: String(tech) });
      await NfcManager.requestTechnology(tech);
      techRequestedRef.current = true;
      logger.info('[NFC] Kart algılandı, teknoloji hazır');

      setProgress('Belge tipi algılanıyor...');
      const docType = await detectDocumentType();
      logger.info('[NFC] Belge tipi', { docType });

      let result = null;

      if (docType === 'id_card') {
        setProgress('Kimlik kartı okunuyor...');
        logger.info('[NFC] readIDCard (DG1/DG2/DG11) başlıyor');
        try {
          result = await readIDCard();
          logger.info('[NFC] readIDCard tamamlandı', { ad: result?.ad, soyad: result?.soyad, kimlikNo: result?.kimlikNo, hasPhoto: !!result?.chipPhotoBase64 });
          setLastResult(result);
          return { success: true, data: result };
        } catch (idErr) {
          logger.warn('[IndependentNfc] Kimlik okuma hatası', idErr?.message);
          return {
            success: false,
            error: 'NFC okunamadı, tekrar dener misiniz? Kartı arkaya tam yaslayıp sabit tutun.',
            fallback: null,
          };
        }
      }

      if (docType === 'passport') {
        setProgress('Pasaport okunuyor...');
        return {
          success: false,
          error: 'NFC okunamadı, tekrar dener misiniz? Pasaportu arkaya yaklaştırıp sabit tutun.',
          fallback: null,
        };
      }

      setProgress('Belge tanınamadı.');
      return { success: false, error: 'NFC okunamadı, tekrar dener misiniz?', fallback: null };
    } catch (error) {
      const msg = error?.message || '';
      logger.warn('[NFC] Okuma hatası (catch)', msg);
      let userMsg = 'NFC okunamadı, tekrar dener misiniz?';
      if (msg.includes('cancelled') || msg.includes('Cancel')) userMsg = 'Okuma iptal edildi.';
      else if (msg.includes('timeout') || msg.includes('Timeout') || /tag.*not|not.*found|connection.*lost/i.test(msg)) userMsg = 'Kart algılanmadı. Telefonun arkasına tam yaslayıp sabit tutun, tekrar deneyin.';
      else if (msg.includes('tag') || msg.includes('lost')) userMsg = 'Bağlantı koptu. Kartı sabit tutup tekrar deneyin.';
      return { success: false, error: userMsg, fallback: null };
    } finally {
      if (techRequestedRef.current) closeNfc();
      setIsReading(false);
      setProgress('');
      logger.info('[NFC] readNfcDirect bitti (finally)');
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
