import { useState, useRef, useCallback, useEffect } from 'react';

const DUPLICATE_THROTTLE_MS = 2500;
const MAX_HISTORY = 10;
const PROCESSING_COOLDOWN_MS = 180;

/**
 * MRZ state: tek kaynak, scanId, önceki okuma, geçmiş, işlem kilidi.
 * Aynı belgeyi kısa sürede tekrar okumayı engeller (fotokopi/A4).
 */
export function useMrzState() {
  const [currentMrz, setCurrentMrz] = useState(null);
  const [previousMrz, setPreviousMrz] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const scanIdRef = useRef(Date.now());
  const lastDocumentKeyRef = useRef('');
  const lastScanTimeRef = useRef(0);
  const currentMrzRef = useRef(null);
  useEffect(() => { currentMrzRef.current = currentMrz; }, [currentMrz]);

  const getDocumentKey = useCallback((payload) => {
    if (!payload) return '';
    const doc = (payload.passportNumber || payload.kimlikNo || '').toString().trim();
    const birth = (payload.birthDate || '').toString().trim();
    const expiry = (payload.expiryDate || '').toString().trim();
    return `${doc}|${birth}|${expiry}`;
  }, []);

  /**
   * Yeni MRZ verisini işle: duplicate/throttle kontrolü, scanId ekle, state güncelle.
   * @param {object} mrzPayload - parseMrz sonucu veya merged payload (documentNumber/passportNumber, birthDate, vb.)
   * @param {{ source?: string, raw?: string }} opts
   * @returns {object|null} Zenginleştirilmiş payload veya duplicate/processing ise null
   */
  const processNewMrz = useCallback((mrzPayload, opts = {}) => {
    if (isProcessing) {
      if (__DEV__) console.log('[useMrzState] Zaten işlem yapılıyor, yeni MRZ kuyruğa alınmadı');
      return null;
    }

    const now = Date.now();
    const docKey = getDocumentKey(mrzPayload);

    if (docKey && lastDocumentKeyRef.current === docKey && now - lastScanTimeRef.current < DUPLICATE_THROTTLE_MS) {
      if (__DEV__) console.log('[useMrzState] Aynı belge kısa sürede tekrar okundu, yok sayıldı', { docKey: docKey.slice(0, 20) });
      return null;
    }

    setIsProcessing(true);
    const newScanId = Date.now();
    scanIdRef.current = newScanId;
    lastScanTimeRef.current = now;
    lastDocumentKeyRef.current = docKey || '';

    const documentNumber = mrzPayload.passportNumber ?? mrzPayload.kimlikNo ?? mrzPayload.pasaportNo ?? '';
    const enriched = {
      ...mrzPayload,
      scanId: newScanId,
      scannedAt: new Date().toISOString(),
      source: opts.source || 'camera',
      raw: opts.raw,
      documentNumber: (documentNumber || '').toString().trim(),
    };

    const prevCurrent = currentMrzRef.current;
    if (prevCurrent) {
      setPreviousMrz(prevCurrent);
      setScanHistory((h) => [prevCurrent, ...h].slice(0, MAX_HISTORY));
    }
    setCurrentMrz(enriched);

    setTimeout(() => setIsProcessing(false), PROCESSING_COOLDOWN_MS);

    if (__DEV__) {
      console.log('🔴 YENİ MRZ İŞLENDİ:', {
        timestamp: enriched.scannedAt,
        documentNumber: enriched.documentNumber,
        scanId: newScanId,
      });
    }

    return enriched;
  }, [getDocumentKey, isProcessing]);

  const clearCurrent = useCallback(() => {
    setCurrentMrz(null);
    lastDocumentKeyRef.current = '';
    lastScanTimeRef.current = 0;
    setIsProcessing(false);
  }, []);

  const setCurrentMrzFromOutside = useCallback((payload) => {
    if (payload) {
      lastDocumentKeyRef.current = getDocumentKey(payload);
      lastScanTimeRef.current = Date.now();
      scanIdRef.current = payload.scanId ?? Date.now();
      setCurrentMrz(payload);
    } else {
      setCurrentMrz(null);
      lastDocumentKeyRef.current = '';
    }
  }, [getDocumentKey]);

  return {
    currentMrz,
    previousMrz,
    scanHistory,
    isProcessing,
    processNewMrz,
    clearCurrent,
    setCurrentMrzFromOutside,
    scanId: scanIdRef.current,
    lastScanTime: lastScanTimeRef.current,
  };
}
