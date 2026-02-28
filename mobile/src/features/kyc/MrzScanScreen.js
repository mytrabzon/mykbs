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
import * as FileSystem from 'expo-file-system';
import ScanHelpSheet from './ScanHelpSheet';

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
  logger.warn('Torch not available', e?.message);
}

const TIMEOUT_MS = 15000;
const MAX_FAILS = 6;
const STABLE_READ_COUNT = 1; // 1 = hemen kabul et (tam otomatik)
const SHOW_INSTANT_RESULT = true;
const ACCEPT_ON_CHECK_FAIL = true; // Check digit hatası olsa da sonuç ekranında göster, kullanıcı düzeltsin

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
    return 'MRZ formatı tanınmadı. MRZ çizgileri tam ve net görünsün (alt 2 satır).';
  }
  if (failCount >= MAX_FAILS) {
    return 'Işık yetersiz, bulanık veya MRZ görünmüyor. İpucu için ? tuşuna basın veya manuel giriş ile devam edin.';
  }
  return 'Işık ve hizayı kontrol edin veya manuel giriş ile devam edin.';
}

// İlk kurulum: Önce native MRZ okuyucu (dev build). Yoksa kamera/galeri fallback (tek çekim + backend OCR).
const USE_UNIFIED_MRZ_FLOW = false;

export default function MrzScanScreen({ navigation }) {
  const route = useRoute();
  const fromCheckIn = !!route.params?.fromCheckIn;
  const [helpVisible, setHelpVisible] = useState(false);
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
  const [isExiting, setIsExiting] = useState(false);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const timeoutRef = useRef(null);
  const mounted = useRef(true);
  const lastStableRawRef = useRef('');
  const stableCountRef = useRef(0);
  const frontCameraRef = useRef(null);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
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
    const t = setTimeout(() => navigation.goBack(), 0);
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
      const t0 = Date.now();
      setLastMrzRaw(raw.slice(0, 30) + '…');
      let payload = parseMrz(raw);
      if (!payload.checks?.ok && raw) {
        const fixed = fixMrzOcrErrors(raw);
        if (fixed !== raw) payload = parseMrz(fixed);
      }
      if (!payload.checks?.ok) {
        const hasMinimalData = (payload.passportNumber || '').trim() && (payload.birthDate || '').trim();
        if (ACCEPT_ON_CHECK_FAIL && hasMinimalData) {
          setLastMrzChecksReason('');
          setMrzCheckFailed(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (SHOW_INSTANT_RESULT && fromCheckIn) {
            setInstantPayload(payload);
          } else if (SHOW_INSTANT_RESULT && !fromCheckIn) {
            navigation.replace('MrzResult', { payload });
          } else {
            lastStableRawRef.current = raw;
            stableCountRef.current = STABLE_READ_COUNT;
            if (fromCheckIn) {
              const num = (payload.passportNumber || '').trim();
              const isTc = /^\d{11}$/.test(num);
              navigation.replace('CheckIn', { mrzPayload: payload, selectedOda: route.params?.selectedOda });
              saveOkutulanBelgeAsync(
                { ad: (payload.givenNames || '').trim(), soyad: (payload.surname || '').trim(), kimlikNo: isTc ? num : null, pasaportNo: !isTc ? num : null, belgeNo: num || null, dogumTarihi: payload.birthDate || null, uyruk: (payload.nationality || 'TÜRK').trim() },
                null
              );
            } else {
              navigation.replace('MrzResult', { payload });
            }
          }
          return;
        }
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
        return;
      }
      setMrzCheckFailed(false);
      setLastMrzChecksReason('');
      if (SHOW_INSTANT_RESULT && fromCheckIn) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setInstantPayload(payload);
        return;
      }
      if (SHOW_INSTANT_RESULT && !fromCheckIn) {
        navigation.replace('MrzResult', { payload });
        return;
      }
      if (lastStableRawRef.current === raw) {
        stableCountRef.current += 1;
        setStableReadCount(stableCountRef.current);
        if (stableCountRef.current >= STABLE_READ_COUNT) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (fromCheckIn) {
            const num = (payload.passportNumber || '').trim();
            const isTc = /^\d{11}$/.test(num);
            navigation.replace('CheckIn', { mrzPayload: payload, selectedOda: route.params?.selectedOda });
            saveOkutulanBelgeAsync(
              {
                ad: (payload.givenNames || '').trim(),
                soyad: (payload.surname || '').trim(),
                kimlikNo: isTc ? num : null,
                pasaportNo: !isTc ? num : null,
                belgeNo: num || null,
                dogumTarihi: payload.birthDate || null,
                uyruk: (payload.nationality || 'TÜRK').trim(),
              },
              null
            );
          } else {
            navigation.replace('MrzResult', { payload });
          }
        }
      } else {
        lastStableRawRef.current = raw;
        stableCountRef.current = 1;
        setStableReadCount(1);
      }
    },
    [navigation, fromCheckIn]
  );

  const processMrzRaw = useCallback(
    (raw) => {
      if (!raw || !mounted.current) return;
      const t0 = Date.now();
      let payload = parseMrz(raw);
      if (!payload.checks?.ok && raw) {
        const fixed = fixMrzOcrErrors(raw);
        if (fixed !== raw) payload = parseMrz(fixed);
      }
      setLastMrzRaw(raw.slice(0, 30) + '…');
      if (payload.checks?.ok) {
        setMrzCheckFailed(false);
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          setInstantPayload(payload);
        } else if (fromCheckIn) {
          navigation.replace('CheckIn', { mrzPayload: payload, selectedOda: route.params?.selectedOda });
        } else {
          navigation.replace('MrzResult', { payload });
        }
      } else if (ACCEPT_ON_CHECK_FAIL && (payload.passportNumber || '').trim() && (payload.birthDate || '').trim()) {
        setMrzCheckFailed(true);
        if (SHOW_INSTANT_RESULT && fromCheckIn) {
          setInstantPayload(payload);
        } else if (fromCheckIn) {
          navigation.replace('CheckIn', { mrzPayload: payload, selectedOda: route.params?.selectedOda });
        } else {
          navigation.replace('MrzResult', { payload });
        }
      } else {
        setLastMrzChecksReason(payload.checks?.reason || 'invalid_format');
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: getFailureReasonMessage(payload.checks?.reason) });
      }
    },
    [navigation, fromCheckIn]
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
        if (raw) processMrzRaw(raw);
        else Toast.show({ type: 'error', text1: 'MRZ bulunamadı', text2: 'MRZ alanı net görünsün, tekrar deneyin.' });
      } catch (e) {
        const msg = e?.message || '';
        Toast.show({
          type: 'error',
          text1: 'MRZ okunamadı',
          text2: msg.includes('sunucu') || msg.includes('giriş') ? 'Backend bağlantısı ve giriş gerekli.' : msg || 'Tekrar deneyin.',
        });
      } finally {
        if (mounted.current) setOcrLoading(false);
      }
    },
    [processMrzRaw]
  );

  /** Tek fotoğraftan otomatik algılama: pasaport/kimlik = MRZ, ehliyet = ön yüz OCR. Galeriden seçimde base64 kullan (FormData content URI sorununu aşar). */
  const uploadImageForDocument = useCallback(
    async (uri) => {
      if (!mounted.current) return;
      setOcrLoading(true);
      try {
        const FileSystem = require('expo-file-system').default;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const { data } = await api.post('/ocr/document-base64', { imageBase64: base64 });
        if (!mounted.current) return;
        const mrzRaw = data?.mrz;
        const mrzPayload = data?.mrzPayload;
        const front = data?.front;
        const merged = data?.merged;
        if (mrzRaw) {
          processMrzRaw(mrzRaw);
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
        Toast.show({ type: 'error', text1: 'Belge okunamadı', text2: 'MRZ veya ön yüz net görünsün.' });
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'Belge okunamadı.' });
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
    await uploadImageForDocument(result.assets[0].uri);
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
    await uploadImageForDocument(result.assets[0].uri);
  }, [uploadImageForDocument]);

  const isoToDDMMYYYY = useCallback((iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return [d, m, y].filter(Boolean).join('.');
  }, []);

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

  const selectedDocType = Platform.OS === 'ios' ? DocType.Passport : mrzDocType;
  const useUnifiedFlow = USE_UNIFIED_MRZ_FLOW;

  const toggleTorch = useCallback(() => {
    if (!TorchModule) return;
    try {
      const next = !torchOn;
      TorchModule.switchState(next);
      setTorchOn(next);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Fener kullanılamıyor', text2: e?.message || 'Bu cihazda desteklenmiyor olabilir.' });
    }
  }, [torchOn]);

  if (!isScreenFocused || isExiting) {
    return <View style={[styles.container, { backgroundColor: '#000', flex: 1 }]} />;
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
            <TouchableOpacity onPress={() => { setInstantPayload(null); setMergedPayload(null); setFrontImageUri(null); setMrzCheckFailed(false); }} style={whiteResultStyles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={whiteResultStyles.headerTitle}>{isKimlik ? 'Kimlik bilgileri (MRZ)' : 'Pasaport bilgileri (MRZ)'}</Text>
            <View style={whiteResultStyles.backBtn} />
          </View>
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
        <CameraView
          ref={frontCameraRef}
          style={StyleSheet.absoluteFill}
        />
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
        </View>
      </SafeAreaView>
    );
  }

  if (!MrzReaderView || useUnifiedFlow) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>MRZ Tara</Text>
          <TouchableOpacity onPress={() => setHelpVisible(true)} style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.mrzPickContainer}>
          <Text style={styles.mrzPickTitle}>Belgeyi tarayın</Text>
          <Text style={styles.mrzPickHint}>
            Pasaport veya kimlik (ön/arka). Kamera ile çekin veya galeriden seçin — backend MRZ/OCR okur.
          </Text>
          {ocrLoading ? (
            <View style={styles.mrzPickLoading}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.mrzPickLoadingText}>Okunuyor…</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.mrzPickPrimaryBtn}
                onPress={handleTakePhotoWithSystemCamera}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={36} color="#fff" />
                <Text style={styles.mrzPickPrimaryBtnText}>Kamera ile çek</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.mrzPickSecondaryBtn}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <Ionicons name="images-outline" size={28} color="#fff" />
                <Text style={styles.mrzPickSecondaryBtnText}>Galeriden seç</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        <ScanHelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <MrzReaderView
        key={selectedDocType}
        style={StyleSheet.absoluteFill}
        docType={selectedDocType}
        cameraSelector={CameraSelector.Back}
        onMRZRead={handleMRZRead}
      />
      <View style={[styles.overlayTop, { paddingTop: insets.top + 8 }, styles.overlayTopZ]} pointerEvents="box-none">
        <TouchableOpacity onPress={goBack} style={styles.overlayIconBtn} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleWrap} pointerEvents="none">
          <Text style={styles.overlayTitle}>MRZ Tara</Text>
        </View>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={styles.overlayIconBtn}>
          <Ionicons name="help-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      {Platform.OS === 'android' && (
        <View style={[styles.docTypeRow, { position: 'absolute', top: insets.top + 56, left: 12, right: 12, zIndex: 10 }]} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.docTypeBtn, selectedDocType === DocType.Passport && styles.docTypeBtnActive]}
            onPress={() => setMrzDocType(DocType.Passport)}
          >
            <Text style={[styles.docTypeBtnText, selectedDocType === DocType.Passport && styles.docTypeBtnTextActive]}>Pasaport</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.docTypeBtn, selectedDocType === DocType.ID && styles.docTypeBtnActive]}
            onPress={() => setMrzDocType(DocType.ID)}
          >
            <Text style={[styles.docTypeBtnText, selectedDocType === DocType.ID && styles.docTypeBtnTextActive]}>Türk kimliği</Text>
          </TouchableOpacity>
        </View>
      )}
      {__DEV__ && showDebug && (
        <View style={[styles.debugPanel, { top: insets.top + 52 }]}>
          <Text style={styles.debugTitle}>Debug</Text>
          <Text style={styles.debugLine}>permission: {permission?.granted ? 'ok' : 'yok'}</Text>
          <Text style={styles.debugLine}>cameraReady: {cameraReady ? 'ok' : 'N/A (native reader)'}</Text>
          <Text style={styles.debugLine}>lastMrz: {lastMrzRaw || '—'}</Text>
          <Text style={styles.debugLine}>checksReason: {lastMrzChecksReason || '—'}</Text>
          <Text style={styles.debugLine}>failCount: {failCount}</Text>
          <Text style={styles.debugLine}>stableReadCount: {stableReadCount}</Text>
        </View>
      )}
      <View style={styles.overlayCenter} pointerEvents="none">
        <View style={styles.frame} />
        <Text style={styles.frameHint}>
          {selectedDocType === DocType.ID
            ? 'Türk kimliği arka yüzündeki MRZ (3 satır) alanını çerçeveleyin · Karanlıkta fener kullanın'
            : 'Pasaport veya kimlik MRZ alanını hizalayın · Karanlıkta fener kullanın'}
        </Text>
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
            {lastMrzChecksReason
              ? (lastMrzChecksReason === 'invalid_format' ? 'MRZ görünmüyor veya format tanınmadı.' : 'Check digit hatası; fener kullanın.')
              : 'Işık veya hiza kontrol edin. ? ile ipucu.'}
          </Text>
        </View>
      )}
      <ScanHelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
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
          Pasaport veya kimlik arkası MRZ alanını çerçeveleyip çekin
        </Text>
        <TouchableOpacity style={styles.captureBtn} onPress={capture} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={40} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
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
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  overlayTopZ: { zIndex: 10, elevation: 10, backgroundColor: 'rgba(0,0,0,0.5)' },
  overlayIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overlayTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)' },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.white },
  iconBtn: { padding: theme.spacing.sm },
  debugPanel: { position: 'absolute', left: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.88)', padding: theme.spacing.sm, borderRadius: 8 },
  debugTitle: { color: theme.colors.warning, fontWeight: '600', marginBottom: 4 },
  debugLine: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  docTypeRow: { flexDirection: 'row', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  docTypeBtn: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  docTypeBtnActive: { backgroundColor: theme.colors.primary },
  docTypeBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  docTypeBtnTextActive: { color: '#fff' },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1, width: '100%' },
  overlayCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '90%', height: 120, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 8 },
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
});

const whiteResultStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, marginBottom: 8 },
  backBtn: { padding: theme.spacing.sm, minWidth: 44 },
  headerTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: '#111' },
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
