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
  throw new Error('Pasaport çipi MRZ ile açılmalı. MRZ kamerayı kullanın.');
}

/**
 * Kimlik kartı: DG1/DG2 okumayı dene (eMRTD GET DATA).
 * Türk kimlik yapısı farklı olabilir; ortak eMRTD tag'leri kullanıyoruz.
 */
async function readIDCard() {
  const { readDG1, readDG2, readDG11, parseDG1ToPayload, extractFieldFromTLV } = require('./IdCardReader');
  const dg1 = await readDG1(transceive);
  logger.info('[NFC] DG1 okundu', { length: dg1?.length ?? 0 });
  const payload = parseDG1ToPayload(dg1);
  logger.info('[NFC] DG1 parse edildi', { ad: payload?.ad, soyad: payload?.soyad, kimlikNo: payload?.kimlikNo, pasaportNo: payload?.pasaportNo });
  let chipPhotoBase64 = null;
  try {
    const dg2 = await readDG2(transceive);
    if (dg2 && dg2.length > 0) {
      chipPhotoBase64 = bytesToBase64(dg2);
      logger.info('[NFC] DG2 (foto) okundu', { length: dg2.length, hasBase64: !!chipPhotoBase64 });
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

      // BAC anahtarı (son MRZ) varsa önce NfcPassportReader kullan — tek oturumda algıla + oku, "algılanmadı" önlenir
      const bacKey = await getLastMrzForBac();
      logger.info('[NFC] BAC anahtarı kontrolü', { hasBacKey: !!(bacKey?.documentNo && bacKey?.birthDate && bacKey?.expiryDate), hasNfcPassportReader: !!NfcPassportReader });
      if (NfcPassportReader && bacKey?.documentNo && bacKey?.birthDate && bacKey?.expiryDate) {
        setProgress('Kimlik veya pasaport kartını telefonun arkasına yaklaştırın ve sabit tutun...');
        logger.info('[NFC] NfcPassportReader.startReading ile okuma başlıyor (BAC ile)');
        try {
          const nfcResult = await NfcPassportReader.startReading({
            bacKey: {
              documentNo: bacKey.documentNo,
              birthDate: bacKey.birthDate,
              expiryDate: bacKey.expiryDate,
            },
          });
          const result = mapPassportReaderResultToPayload(nfcResult);
          logger.info('[NFC] NfcPassportReader sonucu', { hasResult: !!result, ad: result?.ad, soyad: result?.soyad });
          if (result && (result.ad || result.soyad || result.kimlikNo || result.pasaportNo)) {
            setLastResult(result);
            logger.info('[NFC] BAC ile okuma başarılı, payload dönülüyor');
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
              ? 'Kart algılanmadı. Kimlik veya pasaportu telefonun arkasına tam yaslayıp sabit tutun, tekrar deneyin.'
              : 'Çip okunamadı. MRZ sekmesinden kimlik/pasaportu okutup tekrar NFC deneyin.',
            fallback: 'MRZ',
          };
        }
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
        setProgress('Pasaport okunuyor...');
        logger.info('[NFC] Pasaport algılandı ama BAC yok, MRZ ile okutulması gerekiyor');
        return {
          success: false,
          error: 'Pasaport çipi MRZ ile açılır. Önce MRZ sekmesinden pasaportu okutun, sonra burada NFC ile kartı yaklaştırın.',
          fallback: 'MRZ',
        };
      }

      setProgress('Belge tanınamadı.');
      logger.warn('[NFC] Belge tipi unknown, çip tanınamadı');
      return { success: false, error: 'Çip tanınamadı. Kimlik veya pasaport (MRZ okutulmuş olabilir) kullanın.', fallback: 'MRZ' };
    } catch (error) {
      const msg = error?.message || '';
      logger.warn('[NFC] Okuma hatası (catch)', msg);
      let userMsg = msg;
      if (msg.includes('cancelled') || msg.includes('Cancel')) userMsg = 'Okuma iptal edildi.';
      else if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('algılanmadı') || /tag.*not|not.*found|connection.*lost/i.test(msg)) userMsg = 'Kart algılanmadı. Kimlik veya pasaportu telefonun arkasına tam yaslayıp sabit tutun, tekrar deneyin.';
      else if (msg.includes('tag') || msg.includes('lost')) userMsg = 'Bağlantı koptu. Kimlik veya pasaportu sabit tutup tekrar deneyin.';
      else if (msg.includes('IsoDep') || msg.includes('Tech')) userMsg = 'NFC bağlantısı kurulamadı. MRZ sekmesinden kimlik/pasaportu okutup tekrar NFC deneyin.';
      return {
        success: false,
        error: userMsg,
        fallback: 'MRZ',
      };
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
