/**
 * NFC tam kart okuyucu — e‑pasaport ve eID (T.C. kimlik vb.) çiplerini tek akışta okur.
 *
 * BAC (Basic Access Control, ICAO 9303): Çip erişim anahtarı MRZ'den türetilir.
 * - documentNo (belge no) + birthDate (doğum) + expiryDate (son kullanma) → SHA‑1 → 3DES oturum anahtarları.
 * Bu modül sadece yasal BAC akışını kullanır: Kullanıcının girdiği veya daha önce okunan MRZ ile
 * kendi belgesini okuması. Brute‑force veya yetkisiz erişim içermez.
 *
 * Kart yaklaştığı anda: BAC anahtarları sırayla denenir, ilk eşleşmede tüm veri grupları
 * (DG1, DG2, DG7, DG11, DG12 vb.) native kütüphane tarafından okunur ve tek sonuç objesinde döner.
 */

import { logger } from '../../utils/logger';
import { getLastMrzForBac } from '../../utils/lastMrzForBac';
import { getExpandedBACKeys } from './BACBruteForce';
import { storeSuccessfulKey } from '../../utils/bacCache';
import { toUserFriendlyNfcError } from '../../utils/nfcErrorMessages';
import { getNfcAntennaShortHint } from '../../utils/nfcAntennaHint';

let NfcPassportReader = null;
try {
  NfcPassportReader = require('react-native-nfc-passport-reader').default;
} catch (_) {}

/** Tarih metnini yyyy-MM-dd yap (native BAC key formatı). */
function normalizeDateToYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return '';
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  if (/^\d{6}$/.test(s)) return `19${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  return s.replace(/\./g, '-');
}

/**
 * BAC anahtarı objesini native formatına getirir.
 * @param {{ documentNo?: string; passportNumber?: string; birthDate?: string; expiryDate?: string }} key
 * @returns {{ documentNo: string; birthDate: string; expiryDate: string } | null}
 */
export function normalizeBACKey(key) {
  if (!key) return null;
  const documentNo = (key.documentNo ?? key.passportNumber ?? '').trim().replace(/\s/g, '');
  const birthDate = normalizeDateToYYYYMMDD(key.birthDate);
  const expiryDate = normalizeDateToYYYYMMDD(key.expiryDate);
  if (!documentNo || !birthDate || !expiryDate) return null;
  return { documentNo, birthDate, expiryDate };
}

/**
 * Denenecek BAC anahtarlarını toplar: son MRZ, ek anahtarlar, sonra genişletilmiş liste (Türk kimlik + pasaport + cache).
 * @param {{ extraKeys?: Array<{ documentNo?: string; birthDate?: string; expiryDate?: string }>; countryCode?: string }} options
 */
export async function getBACKeysToTry(options = {}) {
  const keys = [];
  const stored = await getLastMrzForBac();
  if (stored?.documentNo && stored?.birthDate && stored?.expiryDate) {
    keys.push({
      documentNo: stored.documentNo,
      birthDate: stored.birthDate,
      expiryDate: stored.expiryDate,
    });
  }
  if (Array.isArray(options.extraKeys)) {
    for (const k of options.extraKeys) {
      const n = normalizeBACKey(k);
      if (n && !keys.some((e) => e.documentNo === n.documentNo && e.birthDate === n.birthDate && e.expiryDate === n.expiryDate)) {
        keys.push(n);
      }
    }
  }
  const expanded = await getExpandedBACKeys({ countryCode: options.countryCode });
  const seen = new Set(keys.map((e) => `${e.documentNo}|${e.birthDate}|${e.expiryDate}`));
  for (const e of expanded) {
    const n = normalizeBACKey(e);
    if (n && !seen.has(`${n.documentNo}|${n.birthDate}|${n.expiryDate}`)) {
      seen.add(`${n.documentNo}|${n.birthDate}|${n.expiryDate}`);
      keys.push(n);
    }
  }
  return keys;
}

/**
 * Native okuyucu çıktısını uygulama veri modeline map eder (tüm alanlar).
 * DG1 (MRZ), DG2 (foto), DG7 (imza), DG11/DG12 (adres vb.) native tarafında okunur.
 */
export function mapNativeResultToFullPayload(r) {
  if (!r || typeof r !== 'object') return null;
  const birth = (r.birthDate || '').trim();
  const dogumTarihi = birth.includes('-') ? birth.split('-').reverse().join('.') : birth;
  const docNo = (r.personalNumber ?? r.identityNo ?? r.documentNo ?? '').trim();
  const isTc = /^\d{11}$/.test(docNo);
  const sonKullanma = (r.expiryDate || '').trim();
  const sonKullanmaTr = sonKullanma.includes('-') ? sonKullanma.split('-').reverse().join('.') : sonKullanma;
  return {
    type: 'id_card',
    ad: (r.firstName ?? '').trim(),
    soyad: (r.lastName ?? '').trim(),
    kimlikNo: isTc ? docNo : null,
    pasaportNo: !isTc ? docNo : null,
    dogumTarihi: dogumTarihi || null,
    uyruk: (r.nationality || 'TÜRK').trim(),
    cinsiyet: r.gender || null,
    sonKullanma: sonKullanmaTr || null,
    chipPhotoBase64: r.originalFacePhoto ?? r.facePhoto ?? null,
    chipSignatureBase64: r.signatureImage ?? r.originalSignature ?? null,
    dogumYeri: (r.placeOfBirth ?? '').trim() || null,
    ikametAdresi: (r.address ?? r.placeOfResidence ?? '').trim() || null,
    // Ham alanlar (native’den gelen diğer alanlar)
    raw: {
      documentNumber: r.documentNumber ?? docNo,
      birthDate: r.birthDate ?? birth,
      expiryDate: r.expiryDate ?? sonKullanma,
      issuingAuthority: r.issuingAuthority ?? null,
      mrz: r.mrz ?? null,
    },
  };
}

/**
 * Tek BAC anahtarı ile kartı okur (native: BAC + tüm DG’ler + foto).
 * @param {{ documentNo: string; birthDate: string; expiryDate: string }} bacKey
 * @param {{ includeImages?: boolean }} options
 */
export async function readCardWithBAC(bacKey, options = {}) {
  if (!NfcPassportReader) throw new Error('NFC pasaport okuyucu kütüphanesi yüklü değil');
  if (!bacKey || !bacKey.documentNo || !bacKey.birthDate || !bacKey.expiryDate) {
    throw new Error('BAC anahtarı eksik: documentNo, birthDate, expiryDate gerekli');
  }
  const includeImages = options.includeImages !== false;
  const result = await NfcPassportReader.startReading({
    bacKey: {
      documentNo: bacKey.documentNo,
      birthDate: bacKey.birthDate,
      expiryDate: bacKey.expiryDate,
    },
    includeImages,
  });
  return mapNativeResultToFullPayload(result);
}

/**
 * Kart yaklaştığı anda tüm bilgileri çeker: BAC anahtarlarını sırayla dener, ilk başarıda tüm DG’leri döndürür.
 * e‑pasaport ve eID (T.C. kimlik vb.) aynı BAC akışı ile okunur.
 *
 * @param {{
 *   extraKeys?: Array<{ documentNo?: string; birthDate?: string; expiryDate?: string }>;
 *   includeImages?: boolean;
 *   onProgress?: (message: string) => void;
 * }} options
 * @returns {Promise<{ success: boolean; data?: object; error?: string; fallback?: string }>}
 */
export async function readAllDataWhenCardNear(options = {}) {
  const onProgress = options?.onProgress ?? (() => {});

  if (!NfcPassportReader) {
    logger.warn('[NfcFullCardReader] NfcPassportReader yok');
    return { success: false, error: 'NFC pasaport okuyucu kullanılamıyor.', fallback: 'MRZ' };
  }

  const keysToTry = await getBACKeysToTry({ extraKeys: options.extraKeys });
  if (keysToTry.length === 0) {
    return {
      success: false,
      error: 'BAC anahtarı yok. Önce MRZ okuyun veya belge no / doğum / son kullanma girin.',
      fallback: 'MRZ',
    };
  }

  const report = (stage, message, progress = 0) => {
    const payload = { stage, message: typeof message === 'string' ? message : '', progress };
    onProgress(payload);
  };
  const antennaHint = getNfcAntennaShortHint();
  report('init', `Kartı telefonun arkasına yaklaştırın. ${antennaHint}`, 0);

  for (let i = 0; i < keysToTry.length; i++) {
    const bacKey = keysToTry[i];
    const isStored = i === 0 && (await getLastMrzForBac())?.documentNo === bacKey.documentNo;
    report('bac', `BAC anahtarı deneniyor (${i + 1}/${keysToTry.length})...`, (i + 1) / keysToTry.length);
    const logCtx = { index: i + 1, total: keysToTry.length, docNo: bacKey.documentNo?.slice(0, 4), fromStored: isStored };
    logger.info('[NfcFullCardReader] BAC denemesi', logCtx);
    try {
      const payload = await readCardWithBAC(bacKey, { includeImages: options.includeImages !== false });
      if (payload && (payload.ad || payload.soyad || payload.kimlikNo || payload.pasaportNo)) {
        logger.info('[NfcFullCardReader] Okuma başarılı', { ad: payload.ad, soyad: payload.soyad });
        const countryCode = payload.kimlikNo ? 'TUR' : 'PAS';
        storeSuccessfulKey(countryCode, bacKey).catch(() => {});
        return { success: true, data: payload };
      }
    } catch (e) {
      const msg = e?.message || '';
      if (/cancel/i.test(msg)) {
        return { success: false, error: 'Okuma iptal edildi.', fallback: null };
      }
      logger.warn('[NfcFullCardReader] BAC denemesi başarısız', msg);
    }
  }

  return {
    success: false,
    error: toUserFriendlyNfcError('Security status not satisfied') || 'Kart okunamadı. MRZ ile önce belge no / doğum / son kullanma kaydedin veya kartı sabit tutup tekrar deneyin.',
    fallback: 'MRZ',
  };
}

export default {
  normalizeBACKey,
  getBACKeysToTry,
  mapNativeResultToFullPayload,
  readCardWithBAC,
  readAllDataWhenCardNear,
  isSupported: !!NfcPassportReader,
};
