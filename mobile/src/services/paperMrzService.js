/**
 * KBS Prime - Kağıt/fotokopi MRZ okuma servisi (HMS benzeri backend).
 * Backend: çoklu ön işleme stratejisi, DPI, skor ve ICAO validasyonu.
 */

import { api } from './api';

/**
 * Kağıt/fotokopi MRZ okuma — backend'de 7 strateji × 3 DPI denenir, en iyi skorlu sonuç döner.
 * @param {string} imageBase64 - JPEG/PNG base64 (data URL prefix olmadan)
 * @returns {Promise<{ success: boolean, text?: string, parsed?: object, confidence?: number, strategy?: string, resolution?: number, validation?: object, score?: number, error?: string }>}
 */
export async function scanPaperMrz(imageBase64) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { success: false, error: 'imageBase64 gerekli' };
  }
  try {
    const response = await api.post('/paper-mrz', { imageBase64 });
    const data = response?.data;
    return {
      success: data?.success ?? false,
      text: data?.text,
      parsed: data?.parsed,
      confidence: data?.confidence,
      strategy: data?.strategy,
      resolution: data?.resolution,
      validation: data?.validation,
      score: data?.score,
      error: data?.error,
    };
  } catch (error) {
    const message = error?.response?.data?.error || error?.message || 'Kağıt MRZ okuma hatası';
    return { success: false, error: message };
  }
}

/**
 * URI'den (galeri/kamera) base64 okuyup kağıt MRZ okutur.
 * @param {string} imageUri - file:// veya content:// URI
 * @returns {Promise<{ success: boolean, text?: string, parsed?: object, ... }>}
 */
export async function scanPaperMrzFromUri(imageUri) {
  if (!imageUri) {
    return { success: false, error: 'imageUri gerekli' };
  }
  try {
    const FileSystem = require('expo-file-system/legacy');
    const encoding = FileSystem.EncodingType?.Base64 ?? 'base64';
    let base64 = await FileSystem.readAsStringAsync(imageUri, { encoding });
    if (!base64) {
      const cachePath = `${FileSystem.cacheDirectory}paper_mrz_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: imageUri, to: cachePath });
      base64 = await FileSystem.readAsStringAsync(cachePath, { encoding });
      await FileSystem.deleteAsync(cachePath, { idempotent: true });
    }
    return scanPaperMrz(base64);
  } catch (e) {
    return { success: false, error: e?.message || 'Görüntü okunamadı' };
  }
}
