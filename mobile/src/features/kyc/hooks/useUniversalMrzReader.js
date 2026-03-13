/**
 * KBS Prime - Evrensel MRZ okuyucu hook (backend API kullanır)
 * Görüntü base64 veya uri (FileSystem ile base64'e çevrilir) ile POST /api/universal-mrz/read.
 */

import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../../../services/apiSupabase';
import { universalParsedToPayload } from '../../../lib/mrz/universalMrzParser';

export function useUniversalMrzReader() {
  const [isReading, setIsReading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);

  const readMrz = useCallback(async (imageUriOrBase64, options = {}) => {
    setIsReading(true);
    setProgress('Görüntü hazırlanıyor...');
    setError(null);

    let imageBase64 = imageUriOrBase64;
    if (typeof imageUriOrBase64 === 'string' && !imageUriOrBase64.startsWith('/') && !imageUriOrBase64.startsWith('file:')) {
      if (imageUriOrBase64.length < 200) {
        setError('Geçersiz görüntü');
        setIsReading(false);
        setProgress('');
        throw new Error('Geçersiz görüntü');
      }
      imageBase64 = imageUriOrBase64;
    } else if (typeof imageUriOrBase64 === 'string') {
      setProgress('Görüntü yükleniyor...');
      try {
        imageBase64 = await FileSystem.readAsStringAsync(imageUriOrBase64, { encoding: FileSystem.EncodingType.Base64 });
      } catch (e) {
        setError(e?.message || 'Görüntü okunamadı');
        setIsReading(false);
        setProgress('');
        throw e;
      }
    }

    setProgress('MRZ okunuyor...');
    try {
      const { data } = await api.post('/universal-mrz/read', {
        imageBase64,
        options: {
          isPhotocopy: !!options.isPhotocopy,
          isScreen: !!options.isScreen,
        },
      });

      setIsReading(false);
      setProgress('');

      if (!data.success || !data.parsed) {
        setError(data.error || 'MRZ okunamadı');
        return {
          success: false,
          confidence: data.confidence || 0,
          mrz: data.mrz || '',
          parsed: data.parsed,
          payload: null,
          error: data.error,
        };
      }

      const payload = universalParsedToPayload(data.parsed, data.mrz);
      return {
        success: true,
        confidence: data.confidence,
        mrz: data.mrz,
        parsed: data.parsed,
        format: data.format,
        payload,
      };
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Sunucu hatası';
      setError(message);
      setIsReading(false);
      setProgress('');
      throw err;
    }
  }, []);

  return { readMrz, isReading, progress, error };
}
