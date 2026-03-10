import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, Image, ScrollView, PanResponder, BackHandler, Dimensions, Vibration, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

/** Belge okunduğunda kullanıcıya bildir: toast + kısa titreşim */
function triggerReadSuccessFeedback() {
  Toast.show({ type: 'success', text1: 'Okundu!', text2: 'Belge bilgileri alındı.' });
  try {
    Vibration.vibrate(100);
  } catch (_) {}
}

import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { parseMrz, fixMrzOcrErrors } from '../../lib/mrz';
import { logger } from '../../utils/logger';
import { useMrzState } from './hooks/useMrzState';
import { api } from '../../services/apiSupabase';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuth } from '../../context/AuthContext';
import { useNfcAutoScanner } from '../nfc/NfcAutoScanner';
import { useIndependentNfcReader } from '../nfc/IndependentNfcReader';
import { CameraFallback } from '../../components/CameraFallback';
import { getNfcEnabled } from '../../utils/nfcSetting';
import { useFamilyCheckIn } from '../../context/FamilyCheckInContext';

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
const MAX_FAILS = 8;
/** Kamera önizlemesi bu süre içinde hazır olmazsa "Kamera açılamadı" göster (siyah ekran donması önlemi). iOS'ta onCameraReady sıklıkla gelmediği için daha kısa. */
const CAMERA_READY_TIMEOUT_MS = Platform.OS === 'ios' ? 4000 : 8000;

// MRZ göründüğü anda anlık çekim — kimlik/pasaport fark etmez
const STABLE_READ_COUNT = 1;
const SHOW_INSTANT_RESULT = true;
const ACCEPT_ON_CHECK_FAIL = true;
const ACCEPT_MINIMAL_DOC_NUMBER_ONLY = true; // Sadece belge no ile de hemen kabul (eksik alanlar sonuç ekranında düzeltilir)

/** Android: otomatik algılama — expo-camera + backend OCR. iOS: native MrzReaderView. */
const USE_UNIFIED_AUTO_SCAN = Platform.OS === 'android';
/** Otomatik algılama için periyodik çekim aralığı (kısa = daha hızlı algılama). */
const UNIFIED_CAPTURE_INTERVAL_MS = 1600;
/** İzin verildikten sonra kamera mount gecikmesi (Android siyah ekran önlemi). */
const UNIFIED_CAMERA_MOUNT_DELAY_MS = Platform.OS === 'android' ? 350 : 150;
/** Kamera bileşenini her zaman bu süre sonra mount et (onLayout'a güvenmeden). */
const UNIFIED_CAMERA_MOUNT_AFTER_MS = 400;
/** Kamera açıldı ama onCameraReady gelmezse (siyah ekran) bu süre sonra fallback göster. */
const UNIFIED_CAMERA_READY_TIMEOUT_MS = 6000;

function Row({ label, value }) {
  const v = value != null && value !== '' ? String(value) : '—';
  return (
    <View style={whiteResultStyles.row}>
      <Text style={whiteResultStyles.rowLabel}>{label}</Text>
      <Text style={whiteResultStyles.rowValue}>{v}</Text>
    </View>
  );
}

/** Pasaport numarasını maskele: ilk 2 + son 3 karakter gösterilir (örn. TR***456) */
function maskPassportNumber(num) {
  if (!num || typeof num !== 'string') return '—';
  const s = num.trim();
  if (s.length <= 5) return s.replace(/.(?=.{1})/g, '*');
  return s.slice(0, 2) + '*****' + s.slice(-3);
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

/** OCR / native okuyucu bazen satırları birleştirir; birleşik MRZ'yi satırlara ayır. */
function cleanMrzMergedLines(rawMrzText) {
  if (!rawMrzText || typeof rawMrzText !== 'string') return rawMrzText;
  const trimmed = rawMrzText.trim();
  const hasNewline = /\n|\r/.test(trimmed);
  const cleaned = trimmed.replace(/\s+/g, '').toUpperCase().replace(/[^A-Z0-9<]/g, '');
  if (cleaned.length < 44) return rawMrzText;
  if (hasNewline) return rawMrzText;
  if (cleaned.length > 100) {
    const firstLine = cleaned.substring(0, 44);
    const secondLine = cleaned.substring(44, 88);
    const fixed = `${firstLine}\n${secondLine}`;
    if (__DEV__) logger.info('[MRZ] Birleşik MRZ düzeltildi (2 satır)', { len: cleaned.length });
    return fixed;
  }
  if (cleaned.length >= 86 && cleaned.length <= 94 && (cleaned[0] === 'I' || cleaned[0] === 'A')) {
    const s1 = cleaned.substring(0, 30);
    const s2 = cleaned.substring(30, 60);
    const s3 = cleaned.substring(60);
    const fixed = `${s1}\n${s2}\n${s3}`;
    if (__DEV__) logger.info('[MRZ] Birleşik MRZ düzeltildi (TD1 3 satır)', { len: cleaned.length });
    return fixed;
  }
  if (cleaned.length >= 88 && cleaned.length <= 100) {
    const firstLine = cleaned.substring(0, 44);
    const secondLine = cleaned.substring(44, 88);
    const fixed = `${firstLine}\n${secondLine}`;
    if (__DEV__) logger.info('[MRZ] Birleşik MRZ düzeltildi (TD3 2 satır)', { len: cleaned.length });
    return fixed;
  }
  return rawMrzText;
}

/** Tek MRZ sistemi: sadece native MrzReaderView. Diğer (expo-camera + backend) kaldırıldı. */

export default function MrzScanScreen({ navigation }) {
  const route = useRoute();
  const { tesis } = useAuth();
  const fromCheckIn = !!route.params?.fromCheckIn;
  // Kamera hiçbir zaman üyelik/tesis onayına bağlı değildir; onay bekleyen kullanıcı da tarama ekranını ve kamerayı görür.
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
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
  const [scanMode, setScanMode] = useState(Platform.OS === 'android' ? DocType.ID : DocType.Passport); // Android: kimlik (3 satır), iOS: kütüphane sadece pasaport destekliyor
  const [mrzLocked, setMrzLocked] = useState(false); // Sonuç gelince true, toggle durur
  const [cameraKey, setCameraKey] = useState(0); // Ekrana her girişte artır → kamera yeniden mount (siyah ekran önlemi)
  const [scanDurationMs, setScanDurationMs] = useState(0); // Milisaniye cinsinden tarama süresi
  const [isExiting, setIsExiting] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [savedToOkutulan, setSavedToOkutulan] = useState(false);
  const [savingOkutulan, setSavingOkutulan] = useState(false);
  /** Ayarlardan NFC açık mı? Kapalıysa tüm NFC işlemleri yapılmaz, NFC butonu gizlenir. */
  const [nfcEnabledInSettings, setNfcEnabledInSettings] = useState(false);
  /** İzin hook gecikmesine karşı: kullanıcı "İzin ver" deyince hemen kamera alanını göster */
  const [permissionGrantedLocal, setPermissionGrantedLocal] = useState(false);
  /** Kamera sadece layout tamamlandıktan sonra mount edilsin (0 yükseklik = siyah ekran önlemi) */
  const [cameraLayoutReady, setCameraLayoutReady] = useState(false);
  /** Android'de kameranın layout'tan sonra mount edilmesi siyah ekranı azaltıyor */
  const [cameraMountDelayDone, setCameraMountDelayDone] = useState(false);
  const layoutFallbackTimeoutRef = useRef(null);
  const cameraMountDelayRef = useRef(null);
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
  const unifiedCameraRef = useRef(null);
  const hasAcceptedForUnifiedRef = useRef(false);
  const [unifiedCameraReady, setUnifiedCameraReady] = useState(false);
  /** iOS siyah ekran önlemi: kamera sadece layout ölçüldükten sonra mount edilir. Android'de Activity hazır olsun diye kısa gecikme. */
  const [unifiedCameraMountReady, setUnifiedCameraMountReady] = useState(false);
  const unifiedMountDelayRef = useRef(null);
  /** Android'de onMountError sonrası yeniden denemek için key artırılır */
  const [unifiedCameraMountKey, setUnifiedCameraMountKey] = useState(0);
  /** Kamera açılamadı (onMountError veya uzun süre hazırlanıyor) — Galeriden seç göster */
  const [unifiedCameraError, setUnifiedCameraError] = useState(false);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const unifiedFallbackTimerRef = useRef(null);
  const unifiedCameraReadyTimeoutRef = useRef(null);
  const nfcHandlerRef = useRef(null);
  const familyCheckIn = useFamilyCheckIn();

  const { processNewMrz, isProcessing: mrzStateProcessing, clearCurrent: clearMrzState } = useMrzState();

  const { readNfcDirect, isReading: nfcIndependentReading, progress: nfcIndependentProgress, closeNfc: closeIndependentNfc, isSupported: nfcReaderSupported } = useIndependentNfcReader();

  const { isScanning: nfcScanning, lastError: nfcError, isSupported: nfcSupported } = useNfcAutoScanner({
    enabled: !!(permission?.granted || permissionGrantedLocal) && nfcEnabledInSettings,
    alertMessage: 'Pasaport veya kimlik kartını telefonun arkasına yaklaştırın…',
    onTagDetected: (tag) => nfcHandlerRef.current?.(tag),
  });

  // Kamera izinlerini zorla kontrol et: izin yoksa iste, reddedilirse Ayarlara Git öner.
  const checkPermission = useCallback(async () => {
    if (!permission) return;
    if (permission.granted) return;
    const result = await requestPermission();
    if (!result?.granted) {
      Alert.alert(
        'Kamera İzni Gerekli',
        'MRZ okumak için kamera izni vermelisiniz. Ayarlardan izin verebilirsiniz.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Ayarlara Git', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // İzin ekrana girildiği anda (MRZ sekmesi tıklanır tıklanmaz) kamera izni iste – üyelik onayından bağımsız.
  const hasRequestedPermissionRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (permission?.granted) return;
      if (hasRequestedPermissionRef.current) return;
      hasRequestedPermissionRef.current = true;
      requestPermission().catch((e) => logger.warn('MRZ kamera izni isteği hatası', e?.message));
      return () => { hasRequestedPermissionRef.current = false; };
    }, [permission?.granted, requestPermission])
  );

  // İzin verilir verilmez kamera mount — gecikme yok (tıklar tıklamaz açılsın)
  const [mrzCameraMountReady, setMrzCameraMountReady] = useState(false);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);
  const [cameraOpenFailed, setCameraOpenFailed] = useState(false);
  const cameraReadyTimeoutRef = useRef(null);

  useEffect(() => {
    if (!permission?.granted) {
      setMrzCameraMountReady(false);
      setCameraPreviewReady(false);
      return;
    }
    setPermissionGrantedLocal(true);
    setMrzCameraMountReady(true);
  }, [permission?.granted]);

  useFocusEffect(
    useCallback(() => {
      logger.info('[MRZ] useFocusEffect: ekran odaklandı (focus gain)', {
        permissionGranted: !!permission?.granted,
        hasMrzReader: !!MrzReaderView,
        platform: Platform.OS,
      });
      mounted.current = true;
      hasLeftScreenRef.current = false;
      setIsExiting(false);
      setIsScreenFocused(true);
      acceptedRawRef.current = '';
      mrzLockedRef.current = false;
      setMrzLocked(false);
      hasAcceptedForUnifiedRef.current = false;
      setUnifiedCameraReady(false);
      setUnifiedCameraMountReady(false);
      setScanMode(DocType.Passport);
      setFailCount(0);
      setLastMrzChecksReason('');
      setInstantPayload(null);
      setMergedPayload(null);
      setFrontImageUri(null);
      setMrzCheckFailed(false);
      getNfcEnabled().then((v) => { if (mounted.current) setNfcEnabledInSettings(!!v); });
      clearMrzState();
      scanStartTimeRef.current = Date.now();

      setCameraOpenFailed(false);
      setCameraPreviewReady(false);
      setCameraLayoutReady(false);
      setCameraMountDelayDone(false);
      setUnifiedCameraMountKey(0);
      setUnifiedCameraError(false);
      if (permission?.granted) {
        setMrzCameraMountReady(true);
        setCameraLayoutReady(true);
        // iOS: CameraView layout'tan sonra mount. Android: kısa gecikme ile mount (kamera başlatma sorununu azaltır).
        if (Platform.OS === 'ios') {
          // iOS onLayout'ta set edilecek
        } else {
          cameraMountDelayRef.current = setTimeout(() => {
            cameraMountDelayRef.current = null;
            if (mounted.current) setCameraMountDelayDone(true);
          }, Platform.OS === 'android' ? 400 : 0);
        }
      }

      return () => {
        logger.info('[MRZ] useFocusEffect: ekran odaktan çıktı (focus loss / cleanup)');
        if (unifiedFallbackTimerRef.current) {
          clearTimeout(unifiedFallbackTimerRef.current);
          unifiedFallbackTimerRef.current = null;
        }
        if (unifiedCameraReadyTimeoutRef.current) {
          clearTimeout(unifiedCameraReadyTimeoutRef.current);
          unifiedCameraReadyTimeoutRef.current = null;
        }
        if (unifiedMountDelayRef.current) {
          clearTimeout(unifiedMountDelayRef.current);
          unifiedMountDelayRef.current = null;
        }
        hasLeftScreenRef.current = true;
        setIsScreenFocused(false);
        setMrzCameraMountReady(false);
        setCameraPreviewReady(false);
        setCameraLayoutReady(false);
        setCameraMountDelayDone(false);
        if (cameraMountDelayRef.current) {
          clearTimeout(cameraMountDelayRef.current);
          cameraMountDelayRef.current = null;
        }
        if (layoutFallbackTimeoutRef.current) {
          clearTimeout(layoutFallbackTimeoutRef.current);
          layoutFallbackTimeoutRef.current = null;
        }
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
    }, [permission?.granted, clearMrzState])
  );

  const goBack = useCallback(() => {
    logger.info('[MRZ] goBack tetiklendi');
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
    logger.info('[MRZ] isExiting true, navigasyon çalıştırılıyor', { canGoBack: navigation.canGoBack() });
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

  /** Tek kamera otomatik tarama: belge MRZ veya ön yüz göründüğünde backend hem MRZ hem OCR yapar. Ref kontrolü + hata toast. */
  useEffect(() => {
    if (!USE_UNIFIED_AUTO_SCAN || !permission?.granted || !unifiedCameraReady) return;
    const runCapture = async () => {
      if (hasAcceptedForUnifiedRef.current || ocrLoading) return;
      const cam = unifiedCameraRef.current;
      if (!cam || typeof cam.takePictureAsync !== 'function') return;
      try {
        setOcrLoading(true);
        const photo = await cam.takePictureAsync({ quality: 0.85, base64: true, skipProcessing: false });
        if (!photo?.base64 || !mounted.current) return;
        if (hasAcceptedForUnifiedRef.current) return;
        const res = await api.post('/ocr/document-base64', { imageBase64: photo.base64 });
        const data = res?.data;
        if (!mounted.current || hasAcceptedForUnifiedRef.current) return;
        const mrzRaw = data?.mrz;
        const mrzPayload = data?.mrzPayload;
        const front = data?.front;
        const merged = data?.merged;
        if (mrzRaw) {
          hasAcceptedForUnifiedRef.current = true;
          processMrzRaw(mrzRaw);
          return;
        }
        if (merged && (merged.ad || merged.soyad || merged.kimlikNo || merged.pasaportNo)) {
          const minimalPayload = {
            passportNumber: merged.pasaportNo || merged.kimlikNo || '',
            birthDate: merged.dogumTarihi ? merged.dogumTarihi.split('.').reverse().join('-') : '',
            givenNames: merged.ad,
            surname: merged.soyad,
            nationality: merged.uyruk || 'TÜRK',
          };
          const enriched = processNewMrz(minimalPayload, { source: 'unified' });
          if (!enriched) {
            Toast.show({ type: 'info', text1: 'Aynı belge', text2: 'Bu belge zaten okundu' });
            return;
          }
          hasAcceptedForUnifiedRef.current = true;
          triggerReadSuccessFeedback();
          setFrontImageUri(photo?.uri || null);
          setMergedPayload(merged);
          setInstantPayload({
            ...minimalPayload,
            scanId: enriched.scanId,
            scannedAt: enriched.scannedAt,
          });
          setScanDurationMs(scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0);
          return;
        }
        if (front && (front.ad || front.soyad || front.kimlikNo || front.pasaportNo)) {
          const docNo = front.kimlikNo || front.pasaportNo || '';
          const minimalPayload = {
            passportNumber: docNo,
            birthDate: front.dogumTarihi ? front.dogumTarihi.split('.').reverse().join('-') : '',
            givenNames: front.ad || '',
            surname: front.soyad || '',
            nationality: front.uyruk || 'TÜRK',
          };
          const enriched = processNewMrz(minimalPayload, { source: 'unified' });
          if (!enriched) {
            Toast.show({ type: 'info', text1: 'Aynı belge', text2: 'Bu belge zaten okundu' });
            return;
          }
          hasAcceptedForUnifiedRef.current = true;
          triggerReadSuccessFeedback();
          setFrontImageUri(photo?.uri || null);
          setMergedPayload({
            ad: front.ad || '',
            soyad: front.soyad || '',
            kimlikNo: front.kimlikNo || null,
            pasaportNo: front.pasaportNo || null,
            dogumTarihi: front.dogumTarihi || null,
            uyruk: front.uyruk || 'TÜRK',
          });
          setInstantPayload({
            ...minimalPayload,
            scanId: enriched.scanId,
            scannedAt: enriched.scannedAt,
          });
          setScanDurationMs(scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0);
        }
      } catch (e) {
        if (mounted.current && !hasAcceptedForUnifiedRef.current) {
          logger.warn('[Unified scan] document-base64 hatası', e?.message);
          const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message;
          const text2 = msg && msg.length > 60 ? msg.slice(0, 57) + '…' : (msg || 'Bağlantı veya sunucu hatası. Tekrar deneyin.');
          Toast.show({ type: 'error', text1: 'Okuma hatası', text2 });
        }
      } finally {
        if (mounted.current) setOcrLoading(false);
      }
    };
    const id = setInterval(runCapture, UNIFIED_CAPTURE_INTERVAL_MS);
    runCapture();
    return () => clearInterval(id);
  }, [permission?.granted, unifiedCameraReady, ocrLoading, processMrzRaw, processNewMrz]);

  /** NFC tag algılandığında tam çip okuma (readNfcDirect); tüm alanlar + fotoğraf çekilir, "yakında" kaldırıldı */
  useEffect(() => {
    nfcHandlerRef.current = async () => {
      if (hasAcceptedForUnifiedRef.current || !mounted.current) return;
      try {
        const result = await readNfcDirect();
        if (!mounted.current || hasAcceptedForUnifiedRef.current) return;
        if (result.success && result.data) {
          hasAcceptedForUnifiedRef.current = true;
          const d = result.data;
          triggerReadSuccessFeedback();
          setMergedPayload({
            ad: d.ad || '',
            soyad: d.soyad || '',
            kimlikNo: d.kimlikNo || null,
            pasaportNo: d.pasaportNo || null,
            dogumTarihi: d.dogumTarihi || null,
            uyruk: d.uyruk || 'TÜRK',
            chipPhotoBase64: d.chipPhotoBase64 || null,
          });
          setInstantPayload({
            givenNames: d.ad || '',
            surname: d.soyad || '',
            passportNumber: (d.kimlikNo || d.pasaportNo || '').trim() || '',
            birthDate: d.dogumTarihi ? (d.dogumTarihi.split('.').reverse().join('-') || null) : null,
            nationality: d.uyruk || 'TÜRK',
            chipPhotoBase64: d.chipPhotoBase64 || null,
          });
          setScanDurationMs(scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0);
        } else {
          Toast.show({
            type: 'info',
            text1: 'NFC okunamadı',
            text2: 'MRZ kamerayı veya galeriden görsel seçin.',
          });
        }
      } catch (e) {
        if (mounted.current && !hasAcceptedForUnifiedRef.current) {
          Toast.show({ type: 'info', text1: 'NFC okunamadı', text2: 'MRZ veya galeriden devam edin.' });
        }
      }
    };
    return () => { nfcHandlerRef.current = null; };
  }, [readNfcDirect]);

  const handleNfcButtonPress = useCallback(async () => {
    if (!nfcEnabledInSettings || nfcIndependentReading || hasAcceptedForUnifiedRef.current || !mounted.current) return;
    try {
      const result = await readNfcDirect();
      if (!mounted.current || hasAcceptedForUnifiedRef.current) return;
      if (result.success && result.data) {
        hasAcceptedForUnifiedRef.current = true;
        const d = result.data;
        triggerReadSuccessFeedback();
        setMergedPayload({
          ad: d.ad || '',
          soyad: d.soyad || '',
          kimlikNo: d.kimlikNo || null,
          pasaportNo: d.pasaportNo || null,
          dogumTarihi: d.dogumTarihi || null,
          uyruk: d.uyruk || 'TÜRK',
          chipPhotoBase64: d.chipPhotoBase64 || null,
        });
        setInstantPayload({
          givenNames: d.ad || '',
          surname: d.soyad || '',
          passportNumber: (d.kimlikNo || d.pasaportNo || '').trim() || '',
          birthDate: d.dogumTarihi ? (d.dogumTarihi.split('.').reverse().join('-') || null) : null,
          nationality: d.uyruk || 'TÜRK',
          chipPhotoBase64: d.chipPhotoBase64 || null,
        });
        setScanDurationMs(scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0);
      } else {
        Toast.show({ type: 'info', text1: 'NFC okunamadı', text2: 'MRZ kamerayı veya galeriden kullanın.' });
      }
    } catch (e) {
      if (mounted.current) Toast.show({ type: 'info', text1: 'NFC okunamadı', text2: 'MRZ veya galeriden devam edin.' });
    }
  }, [nfcEnabledInSettings, nfcIndependentReading, readNfcDirect]);

  const handleMRZRead = useCallback(
    (data) => {
      const raw = typeof data === 'string' ? data : (data?.nativeEvent?.mrz ?? data?.mrz ?? '');
      if (!raw || !mounted.current) return;
      if (acceptedRawRef.current === raw) return;
      const rawCleaned = cleanMrzMergedLines(raw);
      if (__DEV__ && rawCleaned !== raw) logger.info('[MRZ] HAM MRZ (native)', { raw: raw.slice(0, 60) + '…', cleaned: rawCleaned.slice(0, 60) + '…' });
      const scanDurationMs = Date.now() - scanStartTimeRef.current;
      let payload = parseMrz(rawCleaned);
      const docNumFirst = (payload.passportNumber || '').trim();
      const hasMinimalFromFirst = (docNumFirst && (payload.birthDate || payload.expiryDate)) || (ACCEPT_MINIMAL_DOC_NUMBER_ONLY && docNumFirst);
      if (!payload.checks?.ok && rawCleaned && !hasMinimalFromFirst) {
        let fixed = rawCleaned;
        for (let pass = 0; pass < 3; pass++) {
          fixed = fixMrzOcrErrors(fixed || rawCleaned);
          const next = parseMrz(fixed);
          if (next?.checks?.ok) {
            payload = next;
            break;
          }
          if (next?.passportNumber && (next?.birthDate || next?.expiryDate)) {
            payload = next;
            break;
          }
        }
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
        setFrontImageUri(null);
        setMergedPayload(null);
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
        setFrontImageUri(null);
        setMergedPayload(null);
        setInstantPayload(p);
        setScanDurationMs(scanDurationMs);
      };

      if (payload.checks?.ok) {
        setMrzCheckFailed(false);
        setLastMrzChecksReason('');
        const enriched = processNewMrz(payload, { source: 'native', raw: rawCleaned });
        if (!enriched) {
          Toast.show({ type: 'info', text1: 'Aynı belge', text2: 'Bu belge zaten okundu' });
          return;
        }
        if (__DEV__) logger.info('[MRZ] Yeni MRZ okundu (native)', { documentNumber: enriched.documentNumber, scanId: enriched.scanId });
        triggerReadSuccessFeedback();
        Toast.show({ type: 'success', text1: 'Okundu', text2: ((enriched.surname || '') + ' ' + (enriched.givenNames || '')).trim() || 'Belge okundu' });
        if (route.params?.mode === 'family' && familyCheckIn?.addMemberFromScan) {
          familyCheckIn.addMemberFromScan(enriched);
          return;
        }
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          acceptInstant(enriched);
        } else if (SHOW_INSTANT_RESULT && !fromCheckIn) {
          acceptAndNavigate(enriched);
        } else {
          acceptAndNavigate(enriched);
        }
        return;
      }
      if (ACCEPT_ON_CHECK_FAIL && hasMinimalData) {
        setLastMrzChecksReason('');
        setMrzCheckFailed(true);
        const enriched = processNewMrz(payload, { source: 'native', raw: rawCleaned });
        if (!enriched) {
          Toast.show({ type: 'info', text1: 'Aynı belge', text2: 'Bu belge zaten okundu' });
          return;
        }
        triggerReadSuccessFeedback();
        Toast.show({ type: 'success', text1: 'Okundu', text2: ((enriched.surname || '') + ' ' + (enriched.givenNames || '')).trim() || 'Belge okundu' });
        if (route.params?.mode === 'family' && familyCheckIn?.addMemberFromScan) {
          familyCheckIn.addMemberFromScan(enriched);
          return;
        }
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          acceptInstant(enriched);
        } else {
          acceptAndNavigate(enriched);
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
    [navigation, fromCheckIn, route.params?.selectedOda, processNewMrz]
  );

  const processMrzRaw = useCallback(
    (raw) => {
      if (!raw || !mounted.current) return;
      const rawCleaned = cleanMrzMergedLines(raw);
      if (__DEV__ && rawCleaned !== raw) logger.info('[MRZ] HAM MRZ (processMrzRaw)', { raw: raw.slice(0, 50) + '…' });
      let payload = parseMrz(rawCleaned);
      if (!payload.checks?.ok && rawCleaned) {
        const fixed = fixMrzOcrErrors(rawCleaned);
        if (fixed !== raw) payload = parseMrz(fixed);
      }
      setLastMrzRaw(raw.slice(0, 30) + '…');
      const docNum = (payload.passportNumber || '').trim();
      const hasMinimal =
        payload.checks?.ok ||
        (ACCEPT_ON_CHECK_FAIL && ((docNum && (payload.birthDate || '').trim()) || (ACCEPT_MINIMAL_DOC_NUMBER_ONLY && docNum)));
      if (hasMinimal) {
        const enriched = processNewMrz(payload, { source: 'backend', raw: rawCleaned });
        if (!enriched) {
          Toast.show({ type: 'info', text1: 'Aynı belge', text2: 'Bu belge zaten okundu' });
          return;
        }
        if (__DEV__) logger.info('[MRZ] Yeni MRZ işlendi (backend)', { documentNumber: enriched.documentNumber, scanId: enriched.scanId });
        setMrzCheckFailed(!payload.checks?.ok);
        triggerReadSuccessFeedback();
        setFrontImageUri(null);
        setMergedPayload(null);
        const scanDurationMs = scanStartTimeRef.current ? Date.now() - scanStartTimeRef.current : 0;
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          setInstantPayload(enriched);
        } else if (fromCheckIn) {
          navigation.replace('CheckIn', { mrzPayload: enriched, selectedOda: route.params?.selectedOda, scanDurationMs });
        } else {
          navigation.replace('MrzResult', { payload: enriched, scanDurationMs });
        }
      } else {
        setLastMrzChecksReason(payload.checks?.reason || 'invalid_format');
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: getFailureReasonMessage(payload.checks?.reason) });
      }
    },
    [navigation, fromCheckIn, route.params?.selectedOda, processNewMrz]
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
        const res = await api.post('/ocr/document-base64', { imageBase64: base64, paperMode: true });
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
          triggerReadSuccessFeedback();
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
          triggerReadSuccessFeedback();
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
        const fallbackReason = data?.mrzFailureReason || 'Belge net görünsün (MRZ bandı veya ön yüz), işık yeterli olsun. Tekrar deneyin.';
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

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Galeri izni gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType?.Images ?? 'images',
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
      mediaTypes: ImagePicker.MediaType?.Images ?? 'images',
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

  // İzin varken kamera alanını hemen mount et (direkt kamera karşılasın)
  useEffect(() => {
    if (!(permission?.granted || permissionGrantedLocal) || !mrzCameraMountReady) return;
    if (!cameraLayoutReady && mounted.current) setCameraLayoutReady(true);
  }, [permission?.granted, permissionGrantedLocal, mrzCameraMountReady, cameraLayoutReady]);

  useFocusEffect(
    useCallback(() => {
      if (!(permission?.granted || permissionGrantedLocal)) return;
      const t = setTimeout(() => {
        if (mounted.current) {
          setCameraLayoutReady(true);
          setCameraMountDelayDone(true);
        }
      }, Platform.OS === 'ios' ? 100 : 30);
      return () => clearTimeout(t);
    }, [permission?.granted, permissionGrantedLocal])
  );

  useEffect(() => {
    if (!cameraLayoutReady) {
      setCameraMountDelayDone(false);
      return;
    }
    // Android: layout hazır olunca hemen mount. iOS: onLayout içinde 150ms gecikmeyle mount ediliyor.
    if (mounted.current && Platform.OS !== 'ios') setCameraMountDelayDone(true);
  }, [cameraLayoutReady]);

  // iOS: Layout geç gelirse 500ms sonra CameraView mount et (fallback)
  useEffect(() => {
    if (Platform.OS !== 'ios' || !permission?.granted) return;
    const t = setTimeout(() => {
      if (mounted.current) {
        setCameraLayoutReady(true);
        setCameraMountDelayDone((done) => {
          if (!done) logger.info('[MRZ] iOS: fallback – CameraView mount');
          return true;
        });
      }
    }, 500);
    return () => clearTimeout(t);
  }, [permission?.granted, Platform.OS]);

  // Unified kamera: izin + MRZ modunda KISA gecikmeyle her zaman mount et (onLayout'a güvenmeden – siyah ekran kalıcı çözüm).
  useEffect(() => {
    if (!USE_UNIFIED_AUTO_SCAN || !(permission?.granted || permissionGrantedLocal)) return;
    if (unifiedFallbackTimerRef.current) clearTimeout(unifiedFallbackTimerRef.current);
    const mountMs = UNIFIED_CAMERA_MOUNT_AFTER_MS;
    unifiedFallbackTimerRef.current = setTimeout(() => {
      unifiedFallbackTimerRef.current = null;
      if (mounted.current) {
        setUnifiedCameraMountReady((ready) => {
          if (!ready) logger.info('[MRZ] Unified kamera mount (sabit gecikme)', { mountMs });
          return true;
        });
      }
    }, mountMs);
    return () => {
      if (unifiedFallbackTimerRef.current) {
        clearTimeout(unifiedFallbackTimerRef.current);
        unifiedFallbackTimerRef.current = null;
      }
    };
  }, [USE_UNIFIED_AUTO_SCAN, permission?.granted, permissionGrantedLocal]);

  // Siyah ekran önlemi: CameraView mount edildi ama onCameraReady gelmezse belirli süre sonra fallback göster.
  useEffect(() => {
    if (!USE_UNIFIED_AUTO_SCAN || !unifiedCameraMountReady || unifiedCameraReady || unifiedCameraError) return;
    if (unifiedCameraReadyTimeoutRef.current) clearTimeout(unifiedCameraReadyTimeoutRef.current);
    unifiedCameraReadyTimeoutRef.current = setTimeout(() => {
      unifiedCameraReadyTimeoutRef.current = null;
      if (mounted.current && !unifiedCameraError) {
        logger.warn('[MRZ] Kamera onCameraReady gelmedi – siyah ekran timeout, fallback gösteriliyor');
        setUnifiedCameraError(true);
        Toast.show({ type: 'info', text1: 'Kamera açılamadı', text2: 'Galeriden görsel seçebilir veya Tekrar dene.' });
      }
    }, UNIFIED_CAMERA_READY_TIMEOUT_MS);
    return () => {
      if (unifiedCameraReadyTimeoutRef.current) {
        clearTimeout(unifiedCameraReadyTimeoutRef.current);
        unifiedCameraReadyTimeoutRef.current = null;
      }
    };
  }, [USE_UNIFIED_AUTO_SCAN, unifiedCameraMountReady, unifiedCameraReady, unifiedCameraError]);

  // Kamera önizlemesi hazır olmazsa (onCameraReady gelmezse) timeout sonunda fallback. Android'de native MrzReaderView kamera hazır sinyali göndermediği için timeout çalıştırma (siyah ekran yanlış tetiklemesin).
  useEffect(() => {
    if (USE_UNIFIED_AUTO_SCAN || Platform.OS === 'ios' || (Platform.OS === 'android' && !USE_UNIFIED_AUTO_SCAN) || !mrzCameraMountReady || !permission?.granted || cameraPreviewReady) return;
    logger.info('[MRZ] Kamera timeout başlatıldı (onCameraReady bekleniyor)', { ms: CAMERA_READY_TIMEOUT_MS, platform: Platform.OS });
    cameraReadyTimeoutRef.current = setTimeout(() => {
      cameraReadyTimeoutRef.current = null;
      logger.warn('[MRZ] Kamera onCameraReady gelmedi – timeout tetiklendi, fallback gösteriliyor', { platform: Platform.OS });
      if (mounted.current) setCameraOpenFailed(true);
    }, CAMERA_READY_TIMEOUT_MS);
    return () => {
      if (cameraReadyTimeoutRef.current) {
        clearTimeout(cameraReadyTimeoutRef.current);
        cameraReadyTimeoutRef.current = null;
      }
    };
  }, [mrzCameraMountReady, permission?.granted, cameraPreviewReady]);

  const selectedDocType = mrzLockedRef.current ? lockedDocTypeRef.current : scanMode;
  selectedDocTypeRef.current = selectedDocType;
  // iOS: @corupta/react-native-mrz-reader sadece PASSPORT destekliyor; ID_CARD verince hata atıyor.
  const docTypeForReader = Platform.OS === 'ios' ? DocType.Passport : selectedDocType;

  const toggleTorch = useCallback(() => {
    if (!TorchModule) {
      Toast.show({ type: 'info', text1: 'Fener', text2: 'Bu cihazda fener desteği yok.' });
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

  // Siyah ekranda kalmayı önle: her durumda geri butonu göster (focus/exit geçişinde de)
  if (!isScreenFocused || isExiting) {
    logger.info('[MRZ] Render: siyah/çıkış durumu', { isScreenFocused, isExiting });
    return (
      <View style={[styles.container, { backgroundColor: '#000', flex: 1 }]}>
        <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <TouchableOpacity onPress={goBack} style={styles.overlayBackBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        {__DEV__ && (
          <View style={{ position: 'absolute', bottom: 40, left: 16, right: 16 }}>
            <Text style={{ color: '#888', fontSize: 11 }}>
              [MRZ debug] isScreenFocused={String(isScreenFocused)} isExiting={String(isExiting)}
            </Text>
          </View>
        )}
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
      chipPhotoBase64: instantPayload.chipPhotoBase64 || mergedPayload?.chipPhotoBase64 || null,
    };
    const isKimlik = !!display.kimlikNo;
    const belgeNoLabel = isKimlik ? 'TC kimlik no' : 'Pasaport no';
    const belgeNoDisplay = isKimlik ? (display.kimlikNo || display.pasaportNo) : maskPassportNumber(display.pasaportNo || display.kimlikNo);
    const hasArabicName = !!(display.nameAr || display.adAr || display.soyadAr);
    const chipPhotoUri = (display.chipPhotoBase64 && !display.chipPhotoBase64.startsWith('data:'))
      ? `data:image/jpeg;base64,${display.chipPhotoBase64}`
      : display.chipPhotoBase64 || null;
    return (
      <SafeAreaView style={whiteResultStyles.container} edges={['top']}>
        <ScrollView contentContainerStyle={whiteResultStyles.scroll}>
          <View style={whiteResultStyles.header}>
            <TouchableOpacity onPress={() => { acceptedRawRef.current = ''; mrzLockedRef.current = false; setMrzLocked(false); setScanMode(DocType.ID); setInstantPayload(null); setMergedPayload(null); setFrontImageUri(null); setMrzCheckFailed(false); setSavedToOkutulan(false); setScanDurationMs(0); }} style={whiteResultStyles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={whiteResultStyles.headerTitle}>{isKimlik ? 'Kimlik bilgileri' : 'Pasaport bilgileri'}</Text>
            <View style={whiteResultStyles.backBtn} />
          </View>
          {scanDurationMs > 0 && (
            <View style={whiteResultStyles.scanTimeBadge}>
              <Text style={whiteResultStyles.scanTimeText}>Okuma süresi: {(scanDurationMs / 1000).toFixed(2)} sn</Text>
            </View>
          )}
          {(frontImageUri || chipPhotoUri) ? (
            <View style={whiteResultStyles.photoWrap}>
              <Image source={{ uri: frontImageUri || chipPhotoUri }} style={whiteResultStyles.photo} resizeMode="cover" />
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
            <Row label={belgeNoLabel} value={belgeNoDisplay} />
            <Row label="Doğum tarihi" value={display.dogumTarihi} />
            <Row label="Uyruk" value={display.uyruk} />
          </View>
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
          <Text style={styles.frameHint}>Belgenin ön yüzünü (fotoğraf ve bilgiler) kameraya gösterip çekin</Text>
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
        </View>
      </SafeAreaView>
    );
  }

  if (!MrzReaderView) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Kimlik / Pasaport</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.mrzPickContainer}>
          <Text style={styles.mrzPickHint}>MRZ okuyucu bu cihazda kullanılamıyor. Lütfen manuel giriş kullanın.</Text>
          <TouchableOpacity style={styles.mrzPickSecondaryBtn} onPress={goBack}>
            <Text style={styles.mrzPickSecondaryBtnText}>Geri</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  logger.info('[MRZ] Native MrzReaderView path', { docTypeForReader });
  if (!(permission?.granted || permissionGrantedLocal)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Kimlik / Pasaport</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.mrzPickContainer}>
          <Ionicons name="camera-outline" size={80} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text style={styles.mrzPickTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.mrzPickHint}>MRZ okumak için kameraya erişim izni vermelisiniz.</Text>
          <TouchableOpacity
            style={styles.mrzPickPrimaryBtn}
            onPress={async () => {
              try {
                const r = await requestPermission();
                if (r?.granted) {
                  setPermissionGrantedLocal(true);
                  setMrzCameraMountReady(true);
                } else {
                  Alert.alert(
                    'Kamera İzni Gerekli',
                    'MRZ okumak için kamera izni vermelisiniz. Ayarlardan izin verebilirsiniz.',
                    [
                      { text: 'Vazgeç', style: 'cancel' },
                      { text: 'Ayarlara Git', onPress: () => Linking.openSettings() },
                    ]
                  );
                }
              } catch (e) {
                Toast.show({ type: 'error', text1: 'Kamera izni alınamadı', text2: e?.message || 'Tekrar deneyin.' });
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={36} color="#fff" />
            <Text style={styles.mrzPickPrimaryBtnText}>İzin ver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mrzPickSecondaryBtn, { marginTop: 12 }]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.mrzPickSecondaryBtnText}>Ayarlara Git</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (USE_UNIFIED_AUTO_SCAN) {
    // Kamera açılamadı: CameraFallback (Galeriden seç / Tekrar dene)
    if (unifiedCameraError) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>Kimlik / Pasaport</Text>
            <View style={styles.iconBtn} />
          </View>
          <View style={{ flex: 1 }}>
            <CameraFallback
              onImageSelected={(asset) => asset?.uri && uploadImageForDocument(asset.uri)}
              onRetry={() => {
                setUnifiedCameraError(false);
                setUnifiedCameraMountKey((k) => k + 1);
                setUnifiedCameraMountReady(false);
                setTimeout(() => setUnifiedCameraMountReady(true), 200);
              }}
            />
          </View>
          <TouchableOpacity style={[styles.mrzPickSecondaryBtn, { marginHorizontal: 20, marginBottom: 16 }]} onPress={goBack}>
            <Text style={styles.mrzPickSecondaryBtnText}>Geri</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <View style={[styles.container, styles.unifiedCameraRoot]}>
        <View
          style={styles.unifiedCameraWrap}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            const hasValidSize = width > 50 && height > 50;
            if (!hasValidSize) return;
            if (unifiedMountDelayRef.current) clearTimeout(unifiedMountDelayRef.current);
            unifiedMountDelayRef.current = setTimeout(() => {
              unifiedMountDelayRef.current = null;
              if (mounted.current) setUnifiedCameraMountReady(true);
            }, UNIFIED_CAMERA_MOUNT_DELAY_MS);
          }}
        >
          {unifiedCameraMountReady ? (
            <CameraView
              key={`unified-cam-${unifiedCameraMountKey}`}
              ref={unifiedCameraRef}
              style={[StyleSheet.absoluteFill, styles.unifiedCameraSize]}
              facing="back"
              onCameraReady={() => {
                if (unifiedCameraReadyTimeoutRef.current) {
                  clearTimeout(unifiedCameraReadyTimeoutRef.current);
                  unifiedCameraReadyTimeoutRef.current = null;
                }
                setUnifiedCameraReady(true);
                setUnifiedCameraError(false);
              }}
              onMountError={(e) => {
                setUnifiedCameraReady(false);
                const msg = e?.nativeEvent?.message || e?.message || 'Kamera açılamadı';
                logger.warn('[MRZ] CameraView onMountError', msg);
                if (Platform.OS === 'android' && unifiedCameraMountKey < 2) {
                  setUnifiedCameraMountReady(false);
                  setTimeout(() => {
                    if (mounted.current) {
                      setUnifiedCameraMountKey((k) => k + 1);
                      setUnifiedCameraMountReady(true);
                    }
                  }, 500);
                  return;
                }
                setUnifiedCameraError(true);
                Toast.show({ type: 'error', text1: 'Kamera açılamadı', text2: msg });
              }}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.unifiedCameraPlaceholder]}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.mrzPickLoadingText}>Kamera hazırlanıyor…</Text>
            </View>
          )}
        </View>
        <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
          <TouchableOpacity onPress={goBack} style={styles.overlayBackBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.overlayBackBtn} />
        </View>
        <View style={[styles.overlayBottom, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
          <View style={styles.overlayBottomBtn} />
          {TorchModule ? (
            <TouchableOpacity style={[styles.overlayBottomBtn, styles.torchBtnRound, torchOn && styles.torchBtnRoundOn]} onPress={toggleTorch} activeOpacity={0.8}>
              <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={28} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.overlayBottomBtn} />
          )}
        </View>
        {ocrLoading && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={[styles.frameHint, { marginTop: 12 }]}>Okunuyor…</Text>
          </View>
        )}
        <View style={[styles.bannerFloating, { bottom: insets.bottom + 80 }]} pointerEvents="box-none">
          <Text style={[styles.bannerText, { marginLeft: 0 }]}>
            Otomatik algılama: belgeyi kameraya tutun (MRZ veya ön yüz), butona basmayın
          </Text>
        </View>
        <View style={[styles.androidFallbackBar, { bottom: insets.bottom + 72 }]} pointerEvents="box-none">
          <Text style={styles.androidFallbackLabel}>Algılanmazsa</Text>
          <View style={styles.androidFallbackRow}>
            <TouchableOpacity style={styles.androidFallbackBtn} onPress={handlePickImage} disabled={ocrLoading} activeOpacity={0.8}>
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={styles.androidFallbackBtnText}>Galeriden seç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.androidFallbackBtn} onPress={handleTakePhotoWithSystemCamera} disabled={ocrLoading} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.androidFallbackBtnText}>Fotoğraf çek</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const showNativeCamera = Platform.OS !== 'android' || cameraMountDelayDone;
  return (
    <View style={styles.container}>
      {showNativeCamera ? (
        <MrzReaderView
          key={`mrz-cam-${cameraKey}-${docTypeForReader}`}
          style={StyleSheet.absoluteFill}
          docType={docTypeForReader}
          cameraSelector={CameraSelector.Back}
          onMRZRead={handleMRZRead}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.unifiedCameraPlaceholder]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.mrzPickLoadingText}>Kamera hazırlanıyor…</Text>
        </View>
      )}
      <View style={[styles.overlayTop, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <TouchableOpacity onPress={goBack} style={styles.overlayBackBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
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
        </View>
        <View style={styles.overlayBackBtn} />
      </View>
      <View style={[styles.overlayBottom, { paddingBottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={styles.overlayBottomBtn} />
        {TorchModule ? (
          <TouchableOpacity style={[styles.overlayBottomBtn, styles.torchBtnRound, torchOn && styles.torchBtnRoundOn]} onPress={toggleTorch} activeOpacity={0.8}>
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={28} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.overlayBottomBtn} />
        )}
      </View>
      {Platform.OS === 'android' && (
        <View style={[styles.androidFallbackBar, { bottom: insets.bottom + 72 }]} pointerEvents="box-none">
          <Text style={styles.androidFallbackLabel}>Kamera okumuyor mu?</Text>
          <View style={styles.androidFallbackRow}>
            <TouchableOpacity style={styles.androidFallbackBtn} onPress={handlePickImage} disabled={ocrLoading} activeOpacity={0.8}>
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={styles.androidFallbackBtnText}>Galeriden seç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.androidFallbackBtn} onPress={handleTakePhotoWithSystemCamera} disabled={ocrLoading} activeOpacity={0.8}>
              <Ionicons name="camera-outline" size={20} color="#fff" />
              <Text style={styles.androidFallbackBtnText}>Fotoğraf çek</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {(timeoutWarning || (failCount > 0 && lastMrzChecksReason)) && (
        <View style={[styles.bannerFloating, { bottom: insets.bottom + (Platform.OS === 'android' ? 130 : 80) }]}>
          <Ionicons name="warning-outline" size={18} color={theme.colors.warning} />
          <Text style={styles.bannerText}>
            {lastMrzChecksReason === 'invalid_format'
              ? 'MRZ tanınmadı. Kimlik: 3 satır, pasaport: 2 satır. Kartı düz tutun, 3 satırı birden gösterin.'
              : (Platform.OS === 'ios' && selectedDocType === DocType.ID
                ? 'Kimlik 3 satır MRZ\'yi tam gösterin. Işık ve hizayı kontrol edin.'
                : 'Işık veya hizayı kontrol edin.')}
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
          Kimlik: 3 satır MRZ; pasaport: 2 satır MRZ. MRZ alanını kameraya gösterip çekin.
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
  /** Unified kamera: root flex 1, wrap sabit boyut (siyah ekran önlemi) */
  unifiedCameraRoot: { flex: 1 },
  unifiedCameraWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  /** Native kamera view'a açıkça boyut ver (0x0 = siyah ekran) */
  unifiedCameraSize: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  unifiedCameraPlaceholder: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  nfcBtnRound: { backgroundColor: 'rgba(6,182,212,0.6)' },
  torchBtnRound: {},
  torchBtnRoundOn: { backgroundColor: 'rgba(255,180,0,0.85)' },
  bannerFloating: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)', padding: 10, borderRadius: 8 },
  bannerText: { marginLeft: theme.spacing.sm, color: '#fff', fontSize: theme.typography.fontSize.sm, flex: 1 },
  androidFallbackBar: { position: 'absolute', left: 12, right: 12, alignItems: 'center', zIndex: 10 },
  androidFallbackLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginBottom: 6 },
  androidFallbackRow: { flexDirection: 'row', gap: 12 },
  androidFallbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  androidFallbackBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  nfcIndicator: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    zIndex: 100,
  },
  nfcIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#06B6D4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  nfcText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  nfcErrorBanner: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 8,
    zIndex: 100,
  },
  nfcErrorText: { marginLeft: 8, color: theme.colors.warning, fontSize: theme.typography.fontSize.sm, flex: 1 },
  nfcFirstRoot: { backgroundColor: '#0A1929' },
  nfcFullScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  nfcAnimation: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#06B6D4',
    borderStyle: 'dashed',
  },
  nfcTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  nfcDescription: { fontSize: 16, color: '#94A3B8', textAlign: 'center', marginBottom: 32, paddingHorizontal: 16 },
  mrzSwitchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
  mrzSwitchText: { color: '#06B6D4', fontSize: 16, fontWeight: '600' },
  infoBar: { paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  infoText: { fontSize: 13, color: '#94A3B8' },
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
  directMrzOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 24, paddingHorizontal: 20, paddingBottom: 36, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center' },
  directMrzHint: { color: 'rgba(255,255,255,0.95)', fontSize: 15, textAlign: 'center', marginBottom: 20, paddingHorizontal: 8 },
  directMrzCaptureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  cameraSlowBanner: { position: 'absolute', bottom: 100, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center' },
  cameraSlowBannerText: { color: 'rgba(255,255,255,0.95)', fontSize: theme.typography.fontSize.sm, textAlign: 'center', marginBottom: 12 },
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
