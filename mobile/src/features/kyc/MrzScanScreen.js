import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, Image, ScrollView, PanResponder, BackHandler, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { parseMrz, fixMrzOcrErrors } from '../../lib/mrz';
import { logger } from '../../utils/logger';
import { api } from '../../services/apiSupabase';
import * as FileSystem from 'expo-file-system/legacy';
/** Okutulan belgeyi backend'e kaydet (arka planda; hata sessiz). */
async function saveOkutulanBelgeAsync(payload, photoUri) {
  try {
    const body = {
      belgeTuru: payload.belgeTuru || (payload.kimlikNo && /^\d{11}$/.test(String(payload.kimlikNo).replace(/\D/g, '')) ? 'kimlik' : 'pasaport'),
      ad: payload.ad || '',
      soyad: payload.soyad || '',
      kimlikNo: payload.kimlikNo || null,
      pasaportNo: payload.pasaportNo || null,
      belgeNo: payload.belgeNo || payload.kimlikNo || payload.pasaportNo || null,
      dogumTarihi: payload.dogumTarihi || null,
      uyruk: payload.uyruk || 'TÜRK',
    };
    if (photoUri && typeof photoUri === 'string') {
      const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
      if (base64) body.photoBase64 = base64;
    }
    await api.post('/okutulan-belgeler', body);
  } catch (e) {
    logger.warn('Okutulan belge kaydı atlandı', e?.message);
  }
}

let MrzReaderView = null;
let CameraSelector = { Back: 'back', Front: 'front' };
let DocType = { Passport: 'PASSPORT', ID: 'ID_CARD' };
try {
  const pkg = require('@corupta/react-native-mrz-reader');
  MrzReaderView = pkg.default;
  CameraSelector = pkg.CameraSelector || CameraSelector;
  DocType = pkg.DocType || DocType;
} catch (e) {
  logger.warn('MRZ reader not available', e?.message);
}

let TorchModule = null;
try {
  const T = require('react-native-torch');
  TorchModule = T.default || T;
} catch (e) {
  logger.debug('Torch not available', e?.message);
}

let ImageManipulator = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {}

const TIMEOUT_MS = 15000;
const MAX_FAILS = 6;
/** Kamera önizlemesi bu süre içinde hazır olmazsa "Kamera açılamadı" göster (siyah ekran donması önlemi) */
const CAMERA_READY_TIMEOUT_MS = 8000;

/** ISO/IEC 7810 ID-1 (kimlik/pasaport kartı) ölçüleri – overlay çerçeve oranı */
const ID1_WIDTH_MM = 85.6;
const ID1_HEIGHT_MM = 53.98;
const ID1_CORNER_RADIUS_MM = 3.18;
const ID1_ASPECT_RATIO = ID1_WIDTH_MM / ID1_HEIGHT_MM;
// MRZ göründüğü anda anlık çekim (en üst düzey) — kimlik/pasaport fark etmez
const STABLE_READ_COUNT = 1;
const SHOW_INSTANT_RESULT = true;
const ACCEPT_ON_CHECK_FAIL = true;
const ACCEPT_MINIMAL_DOC_NUMBER_ONLY = true; // Sadece belge no ile de hemen kabul (eksik alanlar sonuç ekranında düzeltilir)

function Row({ label, value }) {
  const v = value != null && value !== '' ? String(value) : '—';
  return (
    <View style={whiteResultStyles.row}>
      <Text style={whiteResultStyles.rowLabel}>{label}</Text>
      <Text style={whiteResultStyles.rowValue}>{v}</Text>
    </View>
  );
}

function getFailureReasonMessage(checksReason, failCount) {
  if (checksReason === 'document_number_check' || checksReason === 'birth_date_check' || checksReason === 'expiry_date_check') {
    return 'MRZ check digit hatası. Belgeyi net tutun veya flaş kullanın. Manuel giriş ile devam edebilirsiniz.';
  }
  if (checksReason === 'invalid_format') {
    return 'MRZ formatı tanınmadı. Kimlikte 3 satır, pasaportta 2 satır MRZ tam ve net görünsün.';
  }
  if (failCount >= MAX_FAILS) {
    return 'Işık yetersiz, bulanık veya MRZ görünmüyor. Manuel giriş ile devam edebilirsiniz.';
  }
  return 'Işık ve hizayı kontrol edin veya manuel giriş ile devam edin.';
}

// false = MRZ ekranına girince önce kamera (native okuyucu) açılır; native yoksa Kamera ile çek / Galeriden seç butonları.
/** true = girişte doğrudan kamera açılır, pasaport/kimlik otomatik algılanır (seçenek butonları yok). */
const USE_UNIFIED_MRZ_FLOW = true;

export default function MrzScanScreen({ navigation }) {
  const route = useRoute();
  const fromCheckIn = !!route.params?.fromCheckIn;
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showCameraFallback, setShowCameraFallback] = useState(USE_UNIFIED_MRZ_FLOW);
  const [lastMrzRaw, setLastMrzRaw] = useState('');
  const [stableReadCount, setStableReadCount] = useState(0);
  const [lastMrzChecksReason, setLastMrzChecksReason] = useState('');
  const [mrzCheckFailed, setMrzCheckFailed] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [instantPayload, setInstantPayload] = useState(null);
  const [showFrontCamera, setShowFrontCamera] = useState(false);
  const [frontImageUri, setFrontImageUri] = useState(null);
  const [mergedPayload, setMergedPayload] = useState(null);
  const [frontLoading, setFrontLoading] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [mrzDocType, setMrzDocType] = useState(Platform.OS === 'android' ? DocType.ID : DocType.Passport);
  const [scanMode, setScanMode] = useState(DocType.ID); // ID_CARD ↔ Passport döngü (lock öncesi)
  const [mrzLocked, setMrzLocked] = useState(false); // Sonuç gelince true, toggle durur
  const [cameraKey, setCameraKey] = useState(0); // Ekrana her girişte artır → kamera yeniden mount (siyah ekran önlemi)
  const [scanDurationMs, setScanDurationMs] = useState(0); // Milisaniye cinsinden tarama süresi
  const [isExiting, setIsExiting] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [savedToOkutulan, setSavedToOkutulan] = useState(false);
  const [savingOkutulan, setSavingOkutulan] = useState(false);
  const timeoutRef = useRef(null);
  const mounted = useRef(true);
  const lastStableRawRef = useRef('');
  const stableCountRef = useRef(0);
  const acceptedRawRef = useRef(''); // Aynı MRZ ile çift tetiklemeyi engelle (anlık kabul)
  const mrzLockedRef = useRef(false);
  const lockedDocTypeRef = useRef(DocType.ID);
  const selectedDocTypeRef = useRef(DocType.ID);
  const hasLeftScreenRef = useRef(false);
  const scanStartTimeRef = useRef(0);
  const frontCameraRef = useRef(null);
  const mrzCameraRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  // İzin ekrana girildiği anda (MRZ kartı tıklanır tıklanmaz) sistem dialogu çıksın – useFocusEffect ile anında tetikle
  const hasRequestedPermissionRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!USE_UNIFIED_MRZ_FLOW) return;
      if (permission?.granted) return;
      if (hasRequestedPermissionRef.current) return;
      hasRequestedPermissionRef.current = true;
      requestPermission().catch((e) => logger.warn('MRZ kamera izni isteği hatası', e?.message));
      return () => { hasRequestedPermissionRef.current = false; };
    }, [USE_UNIFIED_MRZ_FLOW, permission?.granted, requestPermission])
  );

  // İzin sonrası kısa gecikme: Kamera hemen mount edilirse siyah ekran oluyor. Timer ref ile tutuluyor ki permission referansı değişince cleanup silmesin.
  const [mrzCameraMountReady, setMrzCameraMountReady] = useState(false);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);
  const [cameraOpenFailed, setCameraOpenFailed] = useState(false);
  const cameraReadyTimerRef = useRef(null);
  const cameraReadyTimeoutRef = useRef(null);
  useEffect(() => {
    if (!permission?.granted) {
      if (cameraReadyTimerRef.current) {
        clearTimeout(cameraReadyTimerRef.current);
        cameraReadyTimerRef.current = null;
      }
      setMrzCameraMountReady(false);
      setCameraPreviewReady(false);
      return;
    }
    setMrzCameraMountReady(false);
    setCameraPreviewReady(false);
    cameraReadyTimerRef.current = setTimeout(() => {
      cameraReadyTimerRef.current = null;
      setMrzCameraMountReady(true);
    }, 350);
    return () => {
      if (cameraReadyTimerRef.current) {
        clearTimeout(cameraReadyTimerRef.current);
        cameraReadyTimerRef.current = null;
      }
    };
  }, [permission?.granted]);

  // Ekrana her girişte (geri dönünce) unified flow için gecikmeyi tetikle
  const permissionGrantedRef = useRef(permission?.granted);
  permissionGrantedRef.current = permission?.granted;
  useFocusEffect(
    useCallback(() => {
      if (!USE_UNIFIED_MRZ_FLOW || !permissionGrantedRef.current) return;
      setMrzCameraMountReady(false);
      setCameraPreviewReady(false);
      const id = setTimeout(() => setMrzCameraMountReady(true), 350);
      return () => clearTimeout(id);
    }, [USE_UNIFIED_MRZ_FLOW])
  );

  // İkinci girişte siyah ekran önlemi: kamera mount'unu kısa geciktir (native kameranın serbest kalması için)
  const [cameraReadyToShow, setCameraReadyToShow] = useState(false);
  const isFirstFocusRef = useRef(true);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      hasLeftScreenRef.current = false;
      setIsExiting(false);
      setIsScreenFocused(true);
      acceptedRawRef.current = '';
      mrzLockedRef.current = false;
      setMrzLocked(false);
      setScanMode(DocType.ID);
      setFailCount(0);
      setLastMrzChecksReason('');
      setInstantPayload(null);
      setMergedPayload(null);
      setFrontImageUri(null);
      setMrzCheckFailed(false);
      scanStartTimeRef.current = Date.now();

      setCameraOpenFailed(false);
      setCameraPreviewReady(false);
      const isFirstFocus = isFirstFocusRef.current;
      if (isFirstFocus) {
        isFirstFocusRef.current = false;
        setCameraReadyToShow(false);
        setCameraKey((k) => k + 1);
        const t = setTimeout(() => setCameraReadyToShow(true), 150);
        return () => {
          clearTimeout(t);
          hasLeftScreenRef.current = true;
          setIsScreenFocused(false);
          setMrzCameraMountReady(false);
          setCameraPreviewReady(false);
          if (cameraReadyTimeoutRef.current) {
            clearTimeout(cameraReadyTimeoutRef.current);
            cameraReadyTimeoutRef.current = null;
          }
          if (TorchModule) {
            try {
              TorchModule.switchState(false);
            } catch (e) {}
          }
        };
      }
      setCameraReadyToShow(false);
      setMrzCameraMountReady(false);
      setCameraPreviewReady(false);
      if (cameraReadyTimeoutRef.current) {
        clearTimeout(cameraReadyTimeoutRef.current);
        cameraReadyTimeoutRef.current = null;
      }
      const timer = setTimeout(() => {
        setCameraKey((k) => k + 1);
        setCameraReadyToShow(true);
        setMrzCameraMountReady(true);
      }, 500);
      return () => {
        clearTimeout(timer);
        hasLeftScreenRef.current = true;
        setIsScreenFocused(false);
        setMrzCameraMountReady(false);
        setCameraPreviewReady(false);
        if (cameraReadyTimeoutRef.current) {
          clearTimeout(cameraReadyTimeoutRef.current);
          cameraReadyTimeoutRef.current = null;
        }
        if (TorchModule) {
          try {
            TorchModule.switchState(false);
          } catch (e) {}
        }
      };
    }, [])
  );

  const goBack = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    mounted.current = false;
    setIsScreenFocused(false);
    setIsExiting(true);
  }, []);

  useEffect(() => {
    if (!isExiting) return;
    const t = setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Main');
      }
    }, 0);
    return () => clearTimeout(t);
  }, [isExiting, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => sub.remove();
  }, [goBack]);


  const handleMRZRead = useCallback(
    (data) => {
      const raw = typeof data === 'string' ? data : (data?.nativeEvent?.mrz ?? data?.mrz ?? '');
      if (!raw || !mounted.current) return;
      if (acceptedRawRef.current === raw) return;
      const scanDurationMs = Date.now() - scanStartTimeRef.current;
      let payload = parseMrz(raw);
      if (!payload.checks?.ok && raw) {
        const fixed = fixMrzOcrErrors(raw);
        if (fixed !== raw) payload = parseMrz(fixed);
      }
      const docNum = (payload.passportNumber || '').trim();
      const hasBirth = !!(payload.birthDate || '').trim();
      const hasMinimalData =
        (docNum && hasBirth) || (ACCEPT_MINIMAL_DOC_NUMBER_ONLY && docNum);

      const acceptAndNavigate = (p) => {
        acceptedRawRef.current = raw;
        mrzLockedRef.current = true;
        lockedDocTypeRef.current = selectedDocTypeRef.current;
        setMrzLocked(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (fromCheckIn) {
          const num = (p.passportNumber || '').trim();
          const isTc = /^\d{11}$/.test(num);
          navigation.replace('CheckIn', { mrzPayload: p, selectedOda: route.params?.selectedOda, scanDurationMs });
          saveOkutulanBelgeAsync(
            {
              ad: (p.givenNames || '').trim(),
              soyad: (p.surname || '').trim(),
              kimlikNo: isTc ? num : null,
              pasaportNo: !isTc ? num : null,
              belgeNo: num || null,
              dogumTarihi: p.birthDate || null,
              uyruk: (p.nationality || 'TÜRK').trim(),
            },
            null
          );
        } else {
          navigation.replace('MrzResult', { payload: p, scanDurationMs });
        }
      };

      const acceptInstant = (p) => {
        acceptedRawRef.current = raw;
        mrzLockedRef.current = true;
        lockedDocTypeRef.current = selectedDocTypeRef.current;
        setMrzLocked(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setInstantPayload(p);
        setScanDurationMs(scanDurationMs);
      };

      if (payload.checks?.ok) {
        setMrzCheckFailed(false);
        setLastMrzChecksReason('');
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          acceptInstant(payload);
        } else if (SHOW_INSTANT_RESULT && !fromCheckIn) {
          acceptAndNavigate(payload);
        } else {
          acceptAndNavigate(payload);
        }
        return;
      }
      if (ACCEPT_ON_CHECK_FAIL && hasMinimalData) {
        setLastMrzChecksReason('');
        setMrzCheckFailed(true);
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          acceptInstant(payload);
        } else {
          acceptAndNavigate(payload);
        }
        return;
      }
      setLastMrzRaw(raw.slice(0, 30) + '…');
      setLastMrzChecksReason(payload.checks?.reason || 'invalid_format');
      setStableReadCount(0);
      lastStableRawRef.current = '';
      setFailCount((c) => {
        const next = c + 1;
        if (next >= MAX_FAILS) {
          const reasonMsg = getFailureReasonMessage(payload.checks?.reason, next);
          Alert.alert(
            'Okunamadı',
            reasonMsg,
            [
              { text: 'Tekrar dene', onPress: () => setFailCount(0) },
              { text: 'Manuel giriş', onPress: () => navigation.replace(fromCheckIn ? 'CheckIn' : 'KycManualEntry') },
            ]
          );
        }
        return next;
      });
    },
    [navigation, fromCheckIn, route.params?.selectedOda]
  );

  const processMrzRaw = useCallback(
    (raw) => {
      if (!raw || !mounted.current) return;
      let payload = parseMrz(raw);
      if (!payload.checks?.ok && raw) {
        const fixed = fixMrzOcrErrors(raw);
        if (fixed !== raw) payload = parseMrz(fixed);
      }
      setLastMrzRaw(raw.slice(0, 30) + '…');
      const docNum = (payload.passportNumber || '').trim();
      const hasMinimal =
        payload.checks?.ok ||
        (ACCEPT_ON_CHECK_FAIL && ((docNum && (payload.birthDate || '').trim()) || (ACCEPT_MINIMAL_DOC_NUMBER_ONLY && docNum)));
      if (hasMinimal) {
        setMrzCheckFailed(!payload.checks?.ok);
        const scanDurationMs = scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0;
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          setInstantPayload(payload);
        } else if (fromCheckIn) {
          navigation.replace('CheckIn', { mrzPayload: payload, selectedOda: route.params?.selectedOda, scanDurationMs });
        } else {
          navigation.replace('MrzResult', { payload, scanDurationMs });
        }
      } else {
        setLastMrzChecksReason(payload.checks?.reason || 'invalid_format');
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: getFailureReasonMessage(payload.checks?.reason) });
      }
    },
    [navigation, fromCheckIn, route.params?.selectedOda]
  );

  const uploadImageForMrz = useCallback(
    async (uri) => {
      if (!mounted.current) return;
      setOcrLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', { uri, type: 'image/jpeg', name: 'mrz.jpg' });
        const res = await api.post('/ocr/mrz', formData);
        const raw = res?.data?.raw;
        const score = res?.data?.score;
        const qualityHints = res?.data?.qualityHints;
        const failureReason = res?.data?.failureReason;
        if (raw) {
          processMrzRaw(raw);
          if (typeof score === 'number' && score < 80) {
            Toast.show({ type: 'info', text1: 'Okuma tam net olmayabilir', text2: 'Lütfen bilgileri kontrol edin.' });
          }
        } else {
          if (TorchModule && qualityHints?.suggestTorch === 'on') {
            try {
              TorchModule.switchState(true);
              setTorchOn(true);
              Toast.show({ type: 'info', text1: 'Işık yetersiz', text2: 'Fener açıldı, tekrar deneyin.' });
            } catch (_) {}
          } else if (TorchModule && qualityHints?.suggestTorch === 'off') {
            try {
              TorchModule.switchState(false);
              setTorchOn(false);
            } catch (_) {}
          }
          const reasonText = failureReason || 'Sistem en iyi sonucu almaya çalıştı. Gerekirse manuel girin veya tekrar çekin.';
          Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: reasonText });
        }
      } catch (e) {
        const msg = e?.message || '';
        const backendReason = e?.response?.data?.failureReason || e?.response?.data?.message;
        Toast.show({
          type: 'error',
          text1: 'MRZ okunamadı',
          text2: backendReason || (msg.includes('sunucu') || msg.includes('giriş') ? 'Backend bağlantısı ve giriş gerekli.' : msg) || 'Tekrar deneyin.',
        });
      } finally {
        if (mounted.current) setOcrLoading(false);
      }
    },
    [processMrzRaw]
  );

  /** Tek fotoğraftan otomatik algılama: pasaport/kimlik = MRZ. Galeriden seçimde base64; content URI için önce cache'e kopyala. */
  const uploadImageForDocument = useCallback(
    async (uri) => {
      if (!mounted.current) return;
      setOcrLoading(true);
      logger.info('[Galeri kimlik] Başlatılıyor', { uri: uri ? uri.slice(0, 80) + '…' : '' });
      try {
        let workUri = uri;
        try {
          const Manipulator = require('expo-image-manipulator');
          if (Manipulator && typeof Manipulator.manipulateAsync === 'function') {
            const m = await Manipulator.manipulateAsync(workUri, [{ resize: { width: 1600 } }], { compress: 0.8 });
            if (m?.uri) workUri = m.uri;
          }
        } catch (_) {}
        let base64;
        try {
          base64 = await FileSystem.readAsStringAsync(workUri, { encoding: FileSystem.EncodingType.Base64 });
        } catch (readErr) {
          if (workUri.startsWith('content://') || workUri.startsWith('file://')) {
            const cachePath = `${FileSystem.cacheDirectory}mrz_${Date.now()}.jpg`;
            try {
              await FileSystem.copyAsync({ from: workUri, to: cachePath });
              base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: FileSystem.EncodingType.Base64 });
              await FileSystem.deleteAsync(cachePath, { idempotent: true });
            } catch (copyErr) {
              logger.error('[Galeri kimlik] Base64/kopya hatası: ' + (copyErr?.message || String(copyErr)));
              Toast.show({ type: 'error', text1: 'Görsel okunamadı', text2: 'Dosyayı tekrar seçin veya farklı bir görsel deneyin.' });
              return;
            }
          } else {
            logger.error('[Galeri kimlik] Base64 okuma hatası: ' + (readErr?.message || String(readErr)));
            Toast.show({ type: 'error', text1: 'Görsel okunamadı', text2: readErr?.message || 'Tekrar deneyin.' });
            return;
          }
        }
        logger.info('[Galeri kimlik] Base64 okundu', { base64Len: base64?.length ?? 0 });
        const res = await api.post('/ocr/document-base64', { imageBase64: base64 });
        const data = res?.data;
        if (!mounted.current) return;
        logger.info('[Galeri kimlik] Backend cevabı', {
          hasMrz: !!data?.mrz,
          hasMrzPayload: !!data?.mrzPayload,
          hasMerged: !!data?.merged,
          mergedKeys: data?.merged ? Object.keys(data.merged) : [],
        });
        const mrzRaw = data?.mrz;
        const mrzPayload = data?.mrzPayload;
        const front = data?.front;
        const merged = data?.merged;
        if (mrzRaw) {
          logger.info('[Galeri kimlik] MRZ bulundu, processMrzRaw çağrılıyor');
          processMrzRaw(mrzRaw);
          return;
        }
        const mrzFailureReason = data?.mrzFailureReason;
        if (mrzFailureReason) {
          Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: mrzFailureReason });
          return;
        }
        if (merged && (merged.ad || merged.soyad || merged.kimlikNo || merged.pasaportNo)) {
          setMergedPayload(merged);
          setInstantPayload({
            givenNames: merged.ad,
            surname: merged.soyad,
            passportNumber: merged.pasaportNo || merged.kimlikNo || '',
            birthDate: merged.dogumTarihi ? merged.dogumTarihi.split('.').reverse().join('-') : '',
            nationality: merged.uyruk || 'TÜRK',
          });
          setFrontImageUri(uri);
          return;
        }
        if (front && (front.ad || front.soyad)) {
          const payload = {
            givenNames: front.ad || '',
            surname: front.soyad || '',
            passportNumber: front.pasaportNo || front.kimlikNo || '',
            birthDate: front.dogumTarihi ? front.dogumTarihi.split('.').reverse().join('-') : '',
            nationality: front.uyruk || 'TÜRK',
          };
          setMergedPayload({
            ad: front.ad || '',
            soyad: front.soyad || '',
            kimlikNo: front.kimlikNo || null,
            pasaportNo: front.pasaportNo || null,
            dogumTarihi: front.dogumTarihi || null,
            uyruk: front.uyruk || 'TÜRK',
          });
          setInstantPayload(payload);
          setFrontImageUri(uri);
          return;
        }
        logger.warn('[Galeri kimlik] MRZ ve merged/front yok, belge okunamadı');
        const fallbackReason = data?.mrzFailureReason || 'Belge net görünsün (MRZ bandı veya ön yüz), işık yeterli olsun. Tekrar deneyin veya galeriden seçin.';
        Toast.show({ type: 'error', text1: 'Okunamadı – tekrar deneyin', text2: fallbackReason });
      } catch (e) {
        const msg = e?.message || String(e);
        const resMsg = e?.response?.data?.message || e?.response?.data?.error;
        const failureReason = e?.response?.data?.failureReason;
        const status = e?.response?.status;
        logger.error(`[Galeri kimlik] Hata: ${msg || 'unknown'}` + (resMsg ? ` | backend: ${resMsg}` : '') + (status ? ` | status: ${status}` : ''));
        if (__DEV__) console.warn('[Galeri kimlik] full error', e?.response?.data || e);
        Toast.show({ type: 'error', text1: 'Hata', text2: failureReason || resMsg || msg || 'Belge okunamadı.' });
      } finally {
        if (mounted.current) setOcrLoading(false);
      }
    },
    [processMrzRaw]
  );

  const handleTakePhoto = useCallback(async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Kamera izni gerekli' });
        return;
      }
    }
    setShowCameraFallback(true);
  }, [permission, requestPermission]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Galeri izni gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    let uri = result.assets[0].uri;
    if (ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 2000 } }], { compress: 0.9 });
        if (manipulated?.uri) uri = manipulated.uri;
      } catch (_) {}
    }
    await uploadImageForDocument(uri);
  }, [uploadImageForDocument]);

  /** Sistem kamerasını aç, çekilen fotoğrafı backend'e gönder (expo-camera siyah ekran yerine). */
  const handleTakePhotoWithSystemCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Kamera izni gerekli' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.95,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    let uri = result.assets[0].uri;
    if (ImageManipulator && typeof ImageManipulator.manipulateAsync === 'function') {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 2000 } }], { compress: 0.9 });
        if (manipulated?.uri) uri = manipulated.uri;
      } catch (_) {}
    }
    await uploadImageForDocument(uri);
  }, [uploadImageForDocument]);

  const isoToDDMMYYYY = useCallback((iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return [d, m, y].filter(Boolean).join('.');
  }, []);

  /** Okutulan kimlik/pasaportu sadece "Okutulan kimlikler" listesine kaydet (Ayarlar'da görünür). */
  const handleKaydetOkutulan = useCallback(async () => {
    const p = mergedPayload || instantPayload;
    if (!p) return;
    const display = mergedPayload || {
      ad: (instantPayload?.givenNames || '').trim(),
      soyad: (instantPayload?.surname || '').trim(),
      kimlikNo: /^\d{11}$/.test((instantPayload?.passportNumber || '').trim()) ? (instantPayload?.passportNumber || '').trim() : '',
      pasaportNo: (instantPayload?.passportNumber || '').trim() || '',
      dogumTarihi: isoToDDMMYYYY(instantPayload?.birthDate) || '',
      uyruk: (instantPayload?.nationality || 'TÜRK').trim(),
    };
    const payloadToSave = {
      ad: display.ad || '',
      soyad: display.soyad || '',
      kimlikNo: display.kimlikNo || null,
      pasaportNo: display.pasaportNo || null,
      belgeNo: display.kimlikNo || display.pasaportNo || null,
      dogumTarihi: display.dogumTarihi || null,
      uyruk: display.uyruk || 'TÜRK',
      belgeTuru: display.kimlikNo ? 'kimlik' : 'pasaport',
    };
    if (!payloadToSave.ad || !payloadToSave.soyad) {
      Toast.show({ type: 'error', text1: 'Eksik bilgi', text2: 'Ad ve soyad olmadan kaydedilemez.' });
      return;
    }
    setSavingOkutulan(true);
    try {
      const body = { ...payloadToSave };
      if (frontImageUri && typeof frontImageUri === 'string') {
        const base64 = await FileSystem.readAsStringAsync(frontImageUri, { encoding: FileSystem.EncodingType.Base64 });
        if (base64) body.photoBase64 = base64;
      }
      await api.post('/okutulan-belgeler', body);
      setSavedToOkutulan(true);
      Toast.show({ type: 'success', text1: 'Kaydedildi', text2: 'Ayarlar > Okutulan kimlikler bölümünde görüntüleyebilirsiniz.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: e?.response?.data?.message || 'Tekrar deneyin veya internet bağlantınızı kontrol edin.' });
    } finally {
      setSavingOkutulan(false);
    }
  }, [mergedPayload, instantPayload, frontImageUri, isoToDDMMYYYY]);

  const goToCheckIn = useCallback(
    (payload, photoUri) => {
      const p = payload || mergedPayload || instantPayload;
      if (!p) return;
      const docPhotoUri = frontImageUri || photoUri;
      if (mergedPayload && (mergedPayload.ad || mergedPayload.soyad || mergedPayload.kimlikNo || mergedPayload.pasaportNo)) {
        const documentPayload = {
          ad: mergedPayload.ad || (p.givenNames || '').trim(),
          soyad: mergedPayload.soyad || (p.surname || '').trim(),
          kimlikNo: mergedPayload.kimlikNo || (/^\d{11}$/.test((p.passportNumber || '').trim()) ? (p.passportNumber || '').trim() : ''),
          pasaportNo: mergedPayload.pasaportNo || (p.passportNumber || '').trim() || undefined,
          dogumTarihi: mergedPayload.dogumTarihi || isoToDDMMYYYY(p.birthDate) || '',
          uyruk: mergedPayload.uyruk || (p.nationality || 'TÜRK').trim(),
        };
        navigation.replace('CheckIn', {
          documentPayload,
          photoUri: docPhotoUri || undefined,
          selectedOda: route.params?.selectedOda,
        });
        saveOkutulanBelgeAsync(
          {
            ...documentPayload,
            belgeNo: documentPayload.kimlikNo || documentPayload.pasaportNo || null,
          },
          docPhotoUri
        );
      } else {
        const num = (p.passportNumber || '').trim();
        const isTc = /^\d{11}$/.test(num);
        navigation.replace('CheckIn', {
          mrzPayload: { givenNames: p.givenNames, surname: p.surname, passportNumber: p.passportNumber, birthDate: p.birthDate, nationality: p.nationality },
          photoUri: docPhotoUri || undefined,
          selectedOda: route.params?.selectedOda,
        });
        saveOkutulanBelgeAsync(
          {
            ad: (p.givenNames || '').trim(),
            soyad: (p.surname || '').trim(),
            kimlikNo: isTc ? num : null,
            pasaportNo: !isTc ? num : null,
            belgeNo: num || null,
            dogumTarihi: isoToDDMMYYYY(p.birthDate) || null,
            uyruk: (p.nationality || 'TÜRK').trim(),
          },
          docPhotoUri
        );
      }
    },
    [mergedPayload, instantPayload, frontImageUri, navigation, route.params?.selectedOda, isoToDDMMYYYY]
  );

  const captureFrontAndOcr = useCallback(async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Kamera izni gerekli' });
        return;
      }
    }
    setCameraReady(false);
    setShowFrontCamera(true);
  }, [permission, requestPermission]);

  const onFrontPhotoTaken = useCallback(
    async (uri) => {
      if (!uri || !mounted.current || !instantPayload) return;
      setFrontLoading(true);
      setFrontImageUri(uri);
      try {
        const formData = new FormData();
        formData.append('image', { uri, type: 'image/jpeg', name: 'front.jpg' });
        const { data } = await api.post('/ocr/document', formData);
        const front = data?.front;
        const merged = data?.merged;
        if (merged && (merged.ad || merged.soyad || merged.kimlikNo || merged.pasaportNo)) {
          setMergedPayload(merged);
        } else if (front) {
          setMergedPayload({
            ad: front.ad || (instantPayload.givenNames || '').trim(),
            soyad: front.soyad || (instantPayload.surname || '').trim(),
            kimlikNo: front.kimlikNo || (/^\d{11}$/.test((instantPayload.passportNumber || '').trim()) ? (instantPayload.passportNumber || '').trim() : null),
            pasaportNo: front.pasaportNo || (instantPayload.passportNumber || '').trim() || null,
            dogumTarihi: front.dogumTarihi || isoToDDMMYYYY(instantPayload.birthDate) || null,
            uyruk: front.uyruk || (instantPayload.nationality || 'TÜRK').trim(),
          });
        } else {
          setMergedPayload({
            ad: (instantPayload.givenNames || '').trim(),
            soyad: (instantPayload.surname || '').trim(),
            kimlikNo: /^\d{11}$/.test((instantPayload.passportNumber || '').trim()) ? (instantPayload.passportNumber || '').trim() : null,
            pasaportNo: (instantPayload.passportNumber || '').trim() || null,
            dogumTarihi: isoToDDMMYYYY(instantPayload.birthDate) || null,
            uyruk: (instantPayload.nationality || 'TÜRK').trim(),
          });
        }
        setShowFrontCamera(false);
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Ön yüz okunamadı', text2: e?.message || 'Manuel giriş veya sadece MRZ ile devam edin.' });
        setMergedPayload({
          ad: (instantPayload.givenNames || '').trim(),
          soyad: (instantPayload.surname || '').trim(),
          kimlikNo: /^\d{11}$/.test((instantPayload.passportNumber || '').trim()) ? (instantPayload.passportNumber || '').trim() : null,
          pasaportNo: (instantPayload.passportNumber || '').trim() || null,
          dogumTarihi: isoToDDMMYYYY(instantPayload.birthDate) || null,
          uyruk: (instantPayload.nationality || 'TÜRK').trim(),
        });
        setShowFrontCamera(false);
      } finally {
        if (mounted.current) setFrontLoading(false);
      }
    },
    [instantPayload, api, isoToDDMMYYYY]
  );

  React.useEffect(() => {
    mounted.current = true;
    timeoutRef.current = setTimeout(() => {
      if (mounted.current) setTimeoutWarning(true);
    }, TIMEOUT_MS);
    return () => {
      mounted.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Kamera önizlemesi hazır olmazsa 8 sn sonra "Kamera açılamadı" göster (siyah ekran donması önlemi)
  useEffect(() => {
    if (!mrzCameraMountReady || !permission?.granted || cameraPreviewReady) return;
    cameraReadyTimeoutRef.current = setTimeout(() => {
      cameraReadyTimeoutRef.current = null;
      if (mounted.current) setCameraOpenFailed(true);
    }, CAMERA_READY_TIMEOUT_MS);
    return () => {
      if (cameraReadyTimeoutRef.current) {
        clearTimeout(cameraReadyTimeoutRef.current);
        cameraReadyTimeoutRef.current = null;
      }
    };
  }, [mrzCameraMountReady, permission?.granted, cameraPreviewReady]);

  // DocType toggle: ID_CARD (600–900ms) → Passport (600–900ms) döngüsü; sonuç gelince lock
  const SCAN_MODE_INTERVAL_MS = 1000;
  useEffect(() => {
    if (!MrzReaderView || Platform.OS !== 'android' || mrzLockedRef.current) return;
    const t = setInterval(() => {
      if (!mounted.current || mrzLockedRef.current) return;
      setScanMode((prev) => (prev === DocType.ID ? DocType.Passport : DocType.ID));
    }, SCAN_MODE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [MrzReaderView, mrzLocked]);

  const selectedDocType = mrzLockedRef.current ? lockedDocTypeRef.current : scanMode;
  selectedDocTypeRef.current = selectedDocType;
  // iOS: native reader sadece Pasaport. Kimlik (ID) seçiliyse her zaman Kamera/Galeri + backend kullan;
  // backend TD1 (3 satır MRZ) destekliyor, böylece kimlik kartları güvenilir okunur.
  const docTypeForReader = Platform.OS === 'ios' ? DocType.Passport : selectedDocType;
  const useUnifiedFlow = USE_UNIFIED_MRZ_FLOW || (selectedDocType === DocType.ID);

  const { width: screenWidth } = Dimensions.get('window');
  const frameWidth = screenWidth * 0.9;
  const frameHeight = frameWidth * ID1_ASPECT_RATIO;
  const frameBorderRadius = Math.max(6, (frameWidth * ID1_CORNER_RADIUS_MM) / ID1_HEIGHT_MM);
  const id1FrameStyle = {
    width: frameWidth,
    height: frameHeight,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: frameBorderRadius,
    overflow: 'hidden',
  };
  const mrzZoneHeight = frameHeight * 0.22;
  const mrzZoneStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: mrzZoneHeight,
    borderTopWidth: 2,
    borderColor: 'rgba(0,255,120,0.9)',
    borderBottomLeftRadius: frameBorderRadius,
    borderBottomRightRadius: frameBorderRadius,
    backgroundColor: 'rgba(0,255,120,0.08)',
  };

  const toggleTorch = useCallback(() => {
    if (!TorchModule) {
      Toast.show({ type: 'info', text1: 'Fener', text2: 'Bu sürümde fener desteği yok. Karanlıkta galeriden fotoğraf seçebilirsiniz.' });
      return;
    }
    try {
      const next = !torchOn;
      TorchModule.switchState(next);
      setTorchOn(next);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Fener açılamadı', text2: e?.message || 'Cihaz feneri desteklemiyor olabilir.' });
    }
  }, [torchOn]);

  if (!isScreenFocused || isExiting) {
    return <View style={[styles.container, { backgroundColor: '#000', flex: 1 }]} />;
  }

  // Native kameranın serbest kalması için kısa gecikme (ikinci girişte siyah ekran önlemi)
  if (MrzReaderView && !USE_UNIFIED_MRZ_FLOW && !showCameraFallback && !cameraReadyToShow) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={[styles.mrzPickHint, { marginTop: 16, textAlign: 'center' }]}>Kamera hazırlanıyor…</Text>
      </View>
    );
  }

  if (instantPayload != null && !showFrontCamera) {
    const display = mergedPayload || {
      ad: (instantPayload.givenNames || '').trim(),
      soyad: (instantPayload.surname || '').trim(),
      nameAr: '',
      adAr: '',
      soyadAr: '',
      kimlikNo: /^\d{11}$/.test((instantPayload.passportNumber || '').trim()) ? (instantPayload.passportNumber || '').trim() : '',
      pasaportNo: (instantPayload.passportNumber || '').trim() || '',
      dogumTarihi: isoToDDMMYYYY(instantPayload.birthDate) || '',
      uyruk: (instantPayload.nationality || 'TÜRK').trim(),
    };
    const isKimlik = !!display.kimlikNo;
    const belgeNoLabel = isKimlik ? 'TC kimlik no' : 'Pasaport no';
    const hasArabicName = !!(display.nameAr || display.adAr || display.soyadAr);
    return (
      <SafeAreaView style={whiteResultStyles.container} edges={['top']}>
        <ScrollView contentContainerStyle={whiteResultStyles.scroll}>
          <View style={whiteResultStyles.header}>
            <TouchableOpacity onPress={() => { acceptedRawRef.current = ''; mrzLockedRef.current = false; setMrzLocked(false); setScanMode(DocType.ID); setInstantPayload(null); setMergedPayload(null); setFrontImageUri(null); setMrzCheckFailed(false); setSavedToOkutulan(false); setScanDurationMs(0); }} style={whiteResultStyles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={whiteResultStyles.headerTitle}>{isKimlik ? 'Kimlik bilgileri (MRZ)' : 'Pasaport bilgileri (MRZ)'}</Text>
            <View style={whiteResultStyles.backBtn} />
          </View>
          {scanDurationMs > 0 && (
            <View style={whiteResultStyles.scanTimeBadge}>
              <Text style={whiteResultStyles.scanTimeText}>Okuma süresi: {(scanDurationMs / 1000).toFixed(2)} sn</Text>
            </View>
          )}
          {frontImageUri ? (
            <View style={whiteResultStyles.photoWrap}>
              <Image source={{ uri: frontImageUri }} style={whiteResultStyles.photo} resizeMode="cover" />
            </View>
          ) : null}
          {mrzCheckFailed && (
            <View style={whiteResultStyles.warningBanner}>
              <Ionicons name="warning-outline" size={20} color={theme.colors.warning} />
              <Text style={whiteResultStyles.warningBannerText}>Kontrol hanesi uyuşmuyor; bilgileri kontrol edip gerekirse düzeltin.</Text>
            </View>
          )}
          <View style={whiteResultStyles.card}>
            <Row label="Ad" value={display.ad} />
            <Row label="Soyad" value={display.soyad} />
            {hasArabicName && (
              <>
                {(display.adAr || display.soyadAr) ? (
                  <>
                    <Row label="Ad (Arapça/İngilizce)" value={display.adAr} />
                    <Row label="Soyad (Arapça/İngilizce)" value={display.soyadAr} />
                  </>
                ) : (
                  <Row label="İsim (Arapça/İngilizce)" value={display.nameAr} />
                )}
              </>
            )}
            <Row label={belgeNoLabel} value={display.kimlikNo || display.pasaportNo} />
            <Row label="Doğum tarihi" value={display.dogumTarihi} />
            <Row label="Uyruk" value={display.uyruk} />
          </View>
          {!mergedPayload && !frontLoading ? (
            <TouchableOpacity style={whiteResultStyles.primaryBtn} onPress={captureFrontAndOcr}>
              <Ionicons name="camera" size={22} color="#fff" />
              <Text style={whiteResultStyles.primaryBtnText}>Ön yüzü tara (fotoğraf + daha doğru bilgi)</Text>
            </TouchableOpacity>
          ) : frontLoading ? (
            <View style={whiteResultStyles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={whiteResultStyles.loadingText}>Ön yüz okunuyor...</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[whiteResultStyles.primaryBtn, whiteResultStyles.secondaryBtn]}
            onPress={handleKaydetOkutulan}
            disabled={savingOkutulan}
          >
            {savingOkutulan ? (
              <ActivityIndicator size="small" color="#111" />
            ) : (
              <Ionicons name="save-outline" size={22} color="#111" />
            )}
            <Text style={whiteResultStyles.secondaryBtnText}>
              {savedToOkutulan ? 'Kaydedildi' : 'Kaydet (Okutulan kimlikler)'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[whiteResultStyles.primaryBtn, whiteResultStyles.secondaryBtn]}
            onPress={() => goToCheckIn()}
          >
            <Text style={whiteResultStyles.secondaryBtnText}>Check-in'e geç</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (showFrontCamera) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowFrontCamera(false)} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Ön yüzü çek</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={[StyleSheet.absoluteFill, styles.mrzCameraWrap]}>
          <CameraView
            ref={frontCameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            active={showFrontCamera}
            onCameraReady={() => setCameraReady(true)}
            onMountError={(e) => {
              setCameraReady(false);
              Toast.show({
                type: 'error',
                text1: 'Kamera açılamadı',
                text2: e?.nativeEvent?.message || 'Sistem kamerası ile tekrar deneyin.',
              });
            }}
          />
        </View>
        {!cameraReady && (
          <View style={[StyleSheet.absoluteFill, styles.mrzPickLoading, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }]}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.mrzPickLoadingText}>Kamera hazırlanıyor…</Text>
          </View>
        )}
        <View style={styles.captureOverlay}>
          <Text style={styles.frameHint}>Belgenin ön yüzünü (fotoğraf ve bilgiler) çerçeve içine alıp çekin</Text>
          <TouchableOpacity
            style={styles.captureBtn}
            onPress={async () => {
              if (!frontCameraRef.current || frontLoading) return;
              try {
                const photo = await frontCameraRef.current.takePictureAsync({ quality: 0.9, base64: false });
                if (photo?.uri) await onFrontPhotoTaken(photo.uri);
              } catch (e) {
                Toast.show({ type: 'error', text1: 'Fotoğraf alınamadı', text2: e?.message });
              }
            }}
            disabled={frontLoading}
          >
            {frontLoading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={40} color="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraFallbackLink} onPress={handleTakePhotoWithSystemCamera} disabled={frontLoading}>
            <Text style={styles.cameraFallbackLinkText}>Sistem kamerası ile çek</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Girişte doğrudan kamera: pasaport/kimlik otomatik algılanır, seçenek butonları yok.
  if (!MrzReaderView || useUnifiedFlow) {
    const handleDirectMrzCapture = async () => {
      if (!mrzCameraRef.current || ocrLoading) return;
      if (!permission?.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          Toast.show({ type: 'error', text1: 'Kamera izni gerekli' });
          return;
        }
        return;
      }
      try {
        const photo = await mrzCameraRef.current.takePictureAsync({ quality: 0.95, base64: false });
        if (photo?.uri) await uploadImageForMrz(photo.uri);
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Fotoğraf alınamadı', text2: e?.message });
      }
    };
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>MRZ Tara</Text>
          <View style={styles.iconBtn} />
        </View>
        {!permission?.granted ? (
          <View style={styles.mrzPickContainer}>
            <Text style={styles.mrzPickHint}>Kamera izni gerekli. MRZ tarayabilmek için izin verin.</Text>
            <TouchableOpacity style={styles.mrzPickPrimaryBtn} onPress={async () => { const r = await requestPermission(); if (!r?.granted) Toast.show({ type: 'error', text1: 'İzin reddedildi', text2: 'Ayarlar\'dan kamera iznini açabilirsiniz.' }); }} activeOpacity={0.8}>
              <Ionicons name="camera" size={36} color="#fff" />
              <Text style={styles.mrzPickPrimaryBtnText}>İzin ver</Text>
            </TouchableOpacity>
          </View>
        ) : !mrzCameraMountReady ? (
          <View style={[styles.mrzPickContainer, { flex: 1 }]} pointerEvents="box-none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.mrzPickHint, { marginTop: 16 }]}>Kamera açılıyor…</Text>
            <TouchableOpacity style={[styles.mrzPickPrimaryBtn, { marginTop: 24 }]} onPress={goBack} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
              <Text style={styles.mrzPickPrimaryBtnText}>Geri</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mrzCameraWrap]} collapsable={false}>
            <CameraView
              key={`mrz-cam-${cameraKey}`}
              ref={mrzCameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              active={isScreenFocused && mrzCameraMountReady}
              onCameraReady={() => {
                if (cameraReadyTimeoutRef.current) {
                  clearTimeout(cameraReadyTimeoutRef.current);
                  cameraReadyTimeoutRef.current = null;
                }
                setCameraPreviewReady(true);
                setCameraOpenFailed(false);
              }}
              onMountError={(e) => {
                if (cameraReadyTimeoutRef.current) {
                  clearTimeout(cameraReadyTimeoutRef.current);
                  cameraReadyTimeoutRef.current = null;
                }
                setCameraPreviewReady(false);
                setCameraOpenFailed(true);
                logger.warn('MRZ CameraView mount error', e?.nativeEvent?.message || e?.message);
              }}
            />
            {!cameraPreviewReady && (
              <View style={[StyleSheet.absoluteFill, styles.mrzPickLoading, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }]} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.mrzPickLoadingText}>Kamera hazırlanıyor…</Text>
              </View>
            )}
            {cameraOpenFailed && (
              <View style={styles.cameraSlowBanner} pointerEvents="box-none">
                <Text style={styles.cameraSlowBannerText}>Kamera yavaş açılıyor olabilir.</Text>
                <View style={styles.cameraSlowBannerRow}>
                  <TouchableOpacity style={styles.cameraSlowBannerBtn} onPress={() => { setCameraOpenFailed(false); setCameraPreviewReady(false); if (cameraReadyTimeoutRef.current) { clearTimeout(cameraReadyTimeoutRef.current); cameraReadyTimeoutRef.current = null; } setMrzCameraMountReady(false); setCameraKey((k) => k + 1); setTimeout(() => setMrzCameraMountReady(true), 500); }} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={20} color="#fff" />
                    <Text style={styles.cameraSlowBannerBtnText}>Tekrar dene</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraSlowBannerBtn} onPress={handleTakePhotoWithSystemCamera} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={20} color="#fff" />
                    <Text style={styles.cameraSlowBannerBtnText}>Sistem kamerası</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cameraSlowBannerBtn} onPress={handlePickImage} activeOpacity={0.8}>
                    <Ionicons name="images-outline" size={20} color="#fff" />
                    <Text style={styles.cameraSlowBannerBtnText}>Galeriden seç</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {ocrLoading ? (
              <View style={[StyleSheet.absoluteFill, styles.mrzPickLoading, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.mrzPickLoadingText}>Okunuyor…</Text>
              </View>
            ) : cameraPreviewReady && !cameraOpenFailed ? (
              <View style={styles.directMrzOverlay} pointerEvents="box-none">
                <Text style={styles.directMrzHint}>Pasaport veya kimlik — MRZ alanını çerçeveleyip çekin (otomatik algılanır)</Text>
                <TouchableOpacity style={styles.directMrzCaptureBtn} onPress={handleDirectMrzCapture} activeOpacity={0.8}>
                  <Ionicons name="camera" size={40} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.directMrzGalleryBtn} onPress={handlePickImage} activeOpacity={0.8}>
                  <Ionicons name="images-outline" size={22} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.directMrzGalleryText}>Galeriden seç</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MrzReaderView
        key={`mrz-cam-${cameraKey}-${docTypeForReader}`}
        style={StyleSheet.absoluteFill}
        docType={docTypeForReader}
        cameraSelector={CameraSelector.Back}
        onMRZRead={handleMRZRead}
      />
      <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={goBack} style={styles.overlayBackBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        {Platform.OS === 'android' && (
          <View style={styles.docTypeWrap} pointerEvents="box-none">
            <View style={styles.docTypeRow}>
              <TouchableOpacity
                style={[styles.docTypeBtn, selectedDocType === DocType.Passport && styles.docTypeBtnActive]}
                onPress={() => {
                  setMrzDocType(DocType.Passport);
                  setScanMode(DocType.Passport);
                }}
              >
                <Text style={[styles.docTypeBtnText, selectedDocType === DocType.Passport && styles.docTypeBtnTextActive]}>Pasaport</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docTypeBtn, selectedDocType === DocType.ID && styles.docTypeBtnActive]}
                onPress={() => {
                  setMrzDocType(DocType.ID);
                  setScanMode(DocType.ID);
                }}
              >
                <Text style={[styles.docTypeBtnText, selectedDocType === DocType.ID && styles.docTypeBtnTextActive]}>Kimlik</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.docTypeHint}>Pasaport: 2 satır MRZ · Kimlik: 3 satır MRZ</Text>
          </View>
        )}
        <View style={styles.overlayBackBtn} />
      </View>
      <View style={styles.overlayCenter} pointerEvents="none">
        <View style={[styles.frame, id1FrameStyle]}>
          <View style={mrzZoneStyle} />
        </View>
      </View>
      <View style={[styles.overlayBottom, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <TouchableOpacity style={styles.overlayBottomBtn} onPress={handlePickImage} disabled={ocrLoading} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={28} color="#fff" />
        </TouchableOpacity>
        {TorchModule ? (
          <TouchableOpacity style={[styles.overlayBottomBtn, styles.torchBtnRound, torchOn && styles.torchBtnRoundOn]} onPress={toggleTorch} activeOpacity={0.8}>
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={28} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.overlayBottomBtn} />
        )}
      </View>
      {(timeoutWarning || (failCount > 0 && lastMrzChecksReason)) && (
        <View style={[styles.bannerFloating, { bottom: insets.bottom + 80 }]}>
          <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
          <Text style={styles.bannerText}>
            {lastMrzChecksReason === 'invalid_format' ? 'MRZ tanınmadı. Kimlik 3 satır, pasaport 2 satır olmalı.' : 'Işık veya hizayı kontrol edin.'}
          </Text>
        </View>
      )}
    </View>
  );
}

function CameraFallbackView({ onCapture, onBack, loading, permission, requestPermission, enableTorch, onTorchToggle }) {
  const cameraRef = useRef(null);
  const [ready, setReady] = useState(false);

  const capture = async () => {
    if (!cameraRef.current || loading) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.95,
        base64: false,
        skipProcessing: false,
      });
      if (photo?.uri) await onCapture(photo.uri);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Fotoğraf alınamadı', text2: e?.message });
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.cameraFallback}>
        <Text style={styles.cameraFallbackText}>Kamera izni gerekli</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>İzin ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonBack} onPress={onBack}>
          <Text style={styles.buttonBackText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraFallback}>
      <View style={styles.cameraPreviewWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.cameraPreview}
          facing="back"
          onCameraReady={() => setReady(true)}
          enableTorch={!!enableTorch}
        />
      </View>
      <View style={styles.captureOverlay}>
        <Text style={styles.frameHint}>
          Kimlik: 3 satır MRZ; pasaport: 2 satır MRZ. Alanı çerçeveleyip çekin.
        </Text>
        <TouchableOpacity style={styles.captureBtn} onPress={capture} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={40} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mrzCameraWrap: { minHeight: SCREEN_HEIGHT * 0.5, width: SCREEN_WIDTH },
  mrzPickContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.xl },
  mrzPickTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: '#fff', marginBottom: theme.spacing.sm },
  mrzPickHint: { color: 'rgba(255,255,255,0.85)', fontSize: theme.typography.fontSize.sm, textAlign: 'center', marginBottom: theme.spacing.xl },
  mrzPickLoading: { alignItems: 'center', gap: 12 },
  mrzPickLoadingText: { color: '#fff', fontSize: theme.typography.fontSize.sm },
  mrzPickPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: theme.colors.primary, paddingVertical: 16, paddingHorizontal: 28, borderRadius: 12, marginBottom: theme.spacing.base, minWidth: 220 },
  mrzPickPrimaryBtnText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: '700' },
  mrzPickSecondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', minWidth: 220 },
  mrzPickSecondaryBtnText: { color: '#fff', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  cameraFullScreen: { flex: 1, width: '100%', minHeight: 300, overflow: 'hidden' },
  cameraPlaceholder: { backgroundColor: '#000' },
  cameraAreaWrap: { flex: 1, minHeight: 280 },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, elevation: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  overlayBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  overlayIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overlayTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)' },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.white },
  iconBtn: { padding: theme.spacing.sm },
  debugPanel: { position: 'absolute', left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.88)', padding: theme.spacing.sm, borderRadius: 8 },
  debugTitle: { color: theme.colors.warning, fontWeight: '600', marginBottom: 4 },
  debugLine: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  docTypeWrap: { alignItems: 'center' },
  docTypeRow: { flexDirection: 'row', gap: theme.spacing.sm },
  docTypeHint: { marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  docTypeBtn: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  docTypeBtnActive: { backgroundColor: theme.colors.primary },
  docTypeBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  docTypeBtnTextActive: { color: '#fff' },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1, width: '100%' },
  overlayCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {},
  frameHint: { marginTop: theme.spacing.sm, color: 'rgba(255,255,255,0.95)', fontSize: theme.typography.fontSize.sm, textAlign: 'center', paddingHorizontal: theme.spacing.base },
  frameHintSecondary: { marginTop: 4, color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', paddingHorizontal: theme.spacing.base },
  overlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28 },
  overlayBottomBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  torchBtnRound: {},
  torchBtnRoundOn: { backgroundColor: 'rgba(255,180,0,0.85)' },
  bannerFloating: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)', padding: 10, borderRadius: 8 },
  bannerText: { marginLeft: theme.spacing.sm, color: '#fff', fontSize: theme.typography.fontSize.sm, flex: 1 },
  photoFallbackRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)' },
  photoFallbackBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  photoFallbackBtnText: { color: 'rgba(255,255,255,0.9)', marginLeft: 8, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.warningSoft, padding: theme.spacing.sm, margin: theme.spacing.sm, borderRadius: 8 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  placeholderTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  placeholderText: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.sm },
  placeholderHint: { fontSize: 12, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg, fontStyle: 'italic' },
  button: { marginTop: theme.spacing.sm, ...theme.styles.button.primary, paddingHorizontal: theme.spacing.xl },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.colors.primary },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
  buttonSecondaryText: { color: theme.colors.primary, fontWeight: theme.typography.fontWeight.semibold },
  buttonBack: { marginTop: theme.spacing.xl },
  buttonBackText: { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
  cameraFallback: { flex: 1, position: 'relative', backgroundColor: '#000', minHeight: Dimensions.get('window').height * 0.4 },
  cameraPreviewWrap: { flex: 1, overflow: 'hidden', minHeight: 240 },
  cameraPreview: { flex: 1, width: '100%', height: '100%' },
  cameraFallbackText: { color: '#fff', marginBottom: theme.spacing.base },
  captureOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingVertical: theme.spacing.xl, backgroundColor: 'rgba(0,0,0,0.5)' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  autoScanBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  autoScanBadgeText: { color: '#fff', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  cameraFallbackLink: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 12 },
  cameraFallbackLinkText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textDecorationLine: 'underline' },
  directMrzOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  directMrzHint: { color: 'rgba(255,255,255,0.95)', fontSize: theme.typography.fontSize.sm, textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
  directMrzCaptureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  directMrzGalleryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16 },
  directMrzGalleryText: { color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  cameraSlowBanner: { position: 'absolute', bottom: 100, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  cameraSlowBannerText: { color: 'rgba(255,255,255,0.95)', fontSize: theme.typography.fontSize.sm, textAlign: 'center', marginBottom: 10 },
  cameraSlowBannerRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  cameraSlowBannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 },
  cameraSlowBannerBtnText: { color: '#fff', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
});

const whiteResultStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, marginBottom: 8 },
  backBtn: { padding: theme.spacing.sm, minWidth: 44 },
  headerTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: '#111' },
  scanTimeBadge: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#E8F5E9', borderRadius: 8, marginBottom: theme.spacing.sm },
  scanTimeText: { fontSize: theme.typography.fontSize.sm, color: '#2E7D32', fontWeight: '600' },
  photoWrap: { alignSelf: 'center', width: 120, height: 150, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f0f0f0', marginBottom: theme.spacing.lg },
  photo: { width: '100%', height: '100%' },
  card: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: theme.spacing.lg, marginBottom: theme.spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E9ECEF' },
  rowLabel: { fontSize: theme.typography.fontSize.sm, color: '#6C757D', fontWeight: '500' },
  rowValue: { fontSize: theme.typography.fontSize.base, color: '#111', fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, marginBottom: theme.spacing.sm, gap: 8 },
  primaryBtnText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#E9ECEF' },
  secondaryBtnText: { color: '#111', fontSize: theme.typography.fontSize.base, fontWeight: '700' },
  loadingWrap: { alignItems: 'center', paddingVertical: theme.spacing.lg },
  loadingText: { marginTop: 8, fontSize: theme.typography.fontSize.sm, color: '#6C757D' },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.warningSoft || '#FFF8E6', padding: theme.spacing.sm, borderRadius: 8, marginBottom: theme.spacing.sm },
  warningBannerText: { flex: 1, fontSize: theme.typography.fontSize.sm, color: '#856404' },
});
