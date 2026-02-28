import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { parseMrz, fixMrzOcrErrors } from '../../lib/mrz';
import { logger } from '../../utils/logger';
import { api } from '../../services/apiSupabase';
import ScanHelpSheet from './ScanHelpSheet';

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

const TIMEOUT_MS = 15000;
const MAX_FAILS = 6;
const STABLE_READ_COUNT = 3;
const SHOW_INSTANT_RESULT = true; // MRZ okunur okunmaz anında sonuç ekranına geç

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

// Tek akış: kimlik/pasaport (seçenek kaldırıldı)
const DEFAULT_DOC_TYPE = 'PASSPORT';

export default function MrzScanScreen({ navigation }) {
  const route = useRoute();
  const fromCheckIn = !!route.params?.fromCheckIn;
  const [helpVisible, setHelpVisible] = useState(false);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showCameraFallback, setShowCameraFallback] = useState(false);
  const [lastMrzRaw, setLastMrzRaw] = useState('');
  const [stableReadCount, setStableReadCount] = useState(0);
  const [lastMrzChecksReason, setLastMrzChecksReason] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [ocrLatencyMs, setOcrLatencyMs] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [instantPayload, setInstantPayload] = useState(null);
  const [showFrontCamera, setShowFrontCamera] = useState(false);
  const [frontImageUri, setFrontImageUri] = useState(null);
  const [mergedPayload, setMergedPayload] = useState(null);
  const [frontLoading, setFrontLoading] = useState(false);
  const [readTimeMs, setReadTimeMs] = useState(null);
  const timeoutRef = useRef(null);
  const mounted = useRef(true);
  const lastStableRawRef = useRef('');
  const stableCountRef = useRef(0);
  const frontCameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();


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
      setLastMrzChecksReason('');
      setReadTimeMs(Date.now() - t0);
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
        if (stableCountRef.current >= 3) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          if (fromCheckIn) {
            navigation.replace('CheckIn', { mrzPayload: payload, selectedOda: route.params?.selectedOda });
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
      const latency = Date.now() - t0;
      setOcrLatencyMs(latency);
      setReadTimeMs(latency);
      setLastMrzRaw(raw.slice(0, 30) + '…');
      if (payload.checks?.ok) {
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

  /** Tek fotoğraftan otomatik algılama: pasaport/kimlik = MRZ, ehliyet = ön yüz OCR. Backend tek kaynak — hızlı çalışır. */
  const uploadImageForDocument = useCallback(
    async (uri) => {
      if (!mounted.current) return;
      setOcrLoading(true);
      try {
        const formData = new FormData();
        formData.append('image', { uri, type: 'image/jpeg', name: 'document.jpg' });
        const { data } = await api.post('/ocr/document', formData);
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
          setReadTimeMs(null);
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
          setReadTimeMs(null);
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

  const isoToDDMMYYYY = useCallback((iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return [d, m, y].filter(Boolean).join('.');
  }, []);

  const goToCheckIn = useCallback(
    (payload, photoUri) => {
      const p = payload || mergedPayload || instantPayload;
      if (!p) return;
      if (mergedPayload && (mergedPayload.ad || mergedPayload.soyad || mergedPayload.kimlikNo || mergedPayload.pasaportNo)) {
        navigation.replace('CheckIn', {
          documentPayload: {
            ad: mergedPayload.ad || (p.givenNames || '').trim(),
            soyad: mergedPayload.soyad || (p.surname || '').trim(),
            kimlikNo: mergedPayload.kimlikNo || (/^\d{11}$/.test((p.passportNumber || '').trim()) ? (p.passportNumber || '').trim() : ''),
            pasaportNo: mergedPayload.pasaportNo || (p.passportNumber || '').trim() || undefined,
            dogumTarihi: mergedPayload.dogumTarihi || isoToDDMMYYYY(p.birthDate) || '',
            uyruk: mergedPayload.uyruk || (p.nationality || 'TÜRK').trim(),
          },
          photoUri: frontImageUri || undefined,
          selectedOda: route.params?.selectedOda,
        });
      } else {
        navigation.replace('CheckIn', {
          mrzPayload: { givenNames: p.givenNames, surname: p.surname, passportNumber: p.passportNumber, birthDate: p.birthDate, nationality: p.nationality },
          photoUri: photoUri || undefined,
          selectedOda: route.params?.selectedOda,
        });
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

  const selectedDocType = Platform.OS === 'ios' ? DocType.Passport : DocType.Passport;

  if (instantPayload != null && !showFrontCamera) {
    const display = mergedPayload || {
      ad: (instantPayload.givenNames || '').trim(),
      soyad: (instantPayload.surname || '').trim(),
      kimlikNo: /^\d{11}$/.test((instantPayload.passportNumber || '').trim()) ? (instantPayload.passportNumber || '').trim() : '',
      pasaportNo: (instantPayload.passportNumber || '').trim() || '',
      dogumTarihi: isoToDDMMYYYY(instantPayload.birthDate) || '',
      uyruk: (instantPayload.nationality || 'TÜRK').trim(),
    };
    return (
      <SafeAreaView style={whiteResultStyles.container} edges={['top']}>
        <ScrollView contentContainerStyle={whiteResultStyles.scroll}>
          <View style={whiteResultStyles.header}>
            <TouchableOpacity onPress={() => { setInstantPayload(null); setMergedPayload(null); setFrontImageUri(null); }} style={whiteResultStyles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#111" />
            </TouchableOpacity>
            <Text style={whiteResultStyles.headerTitle}>Kimlik / Pasaport bilgileri</Text>
            <View style={whiteResultStyles.backBtn} />
          </View>
          {readTimeMs != null && (
            <Text style={whiteResultStyles.latency}>{readTimeMs} ms içinde okundu</Text>
          )}
          {frontImageUri ? (
            <View style={whiteResultStyles.photoWrap}>
              <Image source={{ uri: frontImageUri }} style={whiteResultStyles.photo} resizeMode="cover" />
            </View>
          ) : null}
          <View style={whiteResultStyles.card}>
            <Row label="Ad" value={display.ad} />
            <Row label="Soyad" value={display.soyad} />
            <Row label="Belge no" value={display.pasaportNo || display.kimlikNo} />
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

  if (!MrzReaderView) {
    if (showCameraFallback) {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowCameraFallback(false)} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title}>MRZ Tara</Text>
            <View style={styles.iconBtn} />
          </View>
          <CameraFallbackView
            onCapture={uploadImageForDocument}
            onBack={() => setShowCameraFallback(false)}
            loading={ocrLoading}
            permission={permission}
            requestPermission={requestPermission}
          />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.placeholder}>
          <Ionicons name="document-text-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.placeholderTitle}>Pasaport · Kimlik · Ehliyet</Text>
          <Text style={styles.placeholderText}>Otomatik algılanır: MRZ (pasaport/kimlik) veya ön yüz (ehliyet).</Text>
          <TouchableOpacity style={styles.button} onPress={handleTakePhoto} disabled={ocrLoading}>
            <Text style={styles.buttonText}>Kamera ile tara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={handlePickImage} disabled={ocrLoading}>
            <Text style={styles.buttonSecondaryText}>Galeriden seç</Text>
          </TouchableOpacity>
          {ocrLoading && <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 16 }} />}
          <TouchableOpacity style={styles.buttonBack} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonBackText}>Geri</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.titleWrap} onLongPress={() => setShowDebug((d) => !d)}>
          <Text style={styles.title}>MRZ Tara</Text>
          {stableReadCount > 0 && (
            <Text style={styles.stableBadge}>{stableReadCount}/{STABLE_READ_COUNT}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      {showDebug && (
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>Debug</Text>
          <Text style={styles.debugLine}>permission: {permission?.granted ? 'ok' : 'yok'}</Text>
          <Text style={styles.debugLine}>cameraReady: {cameraReady ? 'ok' : 'N/A (native reader)'}</Text>
          <Text style={styles.debugLine}>lastMrz: {lastMrzRaw || '—'}</Text>
          <Text style={styles.debugLine}>checksReason: {lastMrzChecksReason || '—'}</Text>
          <Text style={styles.debugLine}>failCount: {failCount}</Text>
          <Text style={styles.debugLine}>stableReadCount: {stableReadCount}</Text>
          {ocrLatencyMs != null && <Text style={styles.debugLine}>ocrLatencyMs: {ocrLatencyMs}</Text>}
        </View>
      )}
      <View style={styles.cameraWrap}>
        <MrzReaderView
          style={styles.camera}
          docType={selectedDocType}
          cameraSelector={CameraSelector.Back}
          onMRZRead={handleMRZRead}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>Pasaport/kimlik: MRZ alanını hizalayın · Ehliyet: "Fotoğraf ile tara"</Text>
          <Text style={styles.frameHintSecondary}>Belge tipi seçilmez; otomatik algılanır</Text>
        </View>
      </View>
      <View style={styles.photoFallbackRow}>
        <TouchableOpacity style={styles.photoFallbackBtn} onPress={handlePickImage} disabled={ocrLoading}>
          <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={styles.photoFallbackBtnText}>Fotoğraf ile tara</Text>
        </TouchableOpacity>
      </View>
      {(timeoutWarning || (failCount > 0 && lastMrzChecksReason)) && (
        <View style={styles.banner}>
          <Ionicons name="warning-outline" size={20} color={theme.colors.warning} />
          <Text style={styles.bannerText}>
            {lastMrzChecksReason
              ? (lastMrzChecksReason === 'invalid_format' ? 'MRZ görünmüyor veya format tanınmadı. Çizgileri net gösterin.' : 'Check digit hatası; belgeyi net tutun veya flaş kullanın.')
              : 'Işık, odak veya hiza kontrol edin. İpucu için ? tuşuna basın.'}
          </Text>
        </View>
      )}
      <ScanHelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

function CameraFallbackView({ onCapture, onBack, loading, permission, requestPermission }) {
  const cameraRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

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
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        onCameraReady={() => setReady(true)}
        enableTorch={torchOn}
      />
      <View style={styles.captureOverlay}>
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
          onPress={() => setTorchOn((v) => !v)}
        >
          <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={28} color="#fff" />
          <Text style={styles.torchLabel}>{torchOn ? 'Flaş kapat' : 'Flaş aç'}</Text>
        </TouchableOpacity>
        <Text style={styles.frameHint}>MRZ alanını çerçeve içine alıp fotoğraf çekin (karanlıkta flaş kullanın)</Text>
        <TouchableOpacity style={styles.captureBtn} onPress={capture} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={40} color="#fff" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.white },
  stableBadge: { fontSize: 11, color: 'rgba(255,255,255,0.8)', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  iconBtn: { padding: theme.spacing.sm },
  debugPanel: { backgroundColor: 'rgba(0,0,0,0.85)', padding: theme.spacing.sm, marginHorizontal: theme.spacing.sm, marginBottom: 4, borderRadius: 8 },
  debugTitle: { color: theme.colors.warning, fontWeight: '600', marginBottom: 4 },
  debugLine: { color: 'rgba(255,255,255,0.9)', fontSize: 11 },
  docTypeRow: { flexDirection: 'row', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
  docTypeBtn: { flex: 1, paddingVertical: theme.spacing.sm, alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  docTypeBtnActive: { backgroundColor: theme.colors.primary },
  docTypeBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  docTypeBtnTextActive: { color: '#fff' },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1, width: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '90%', height: 120, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 8 },
  frameHint: { marginTop: theme.spacing.sm, color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm },
  frameHintSecondary: { marginTop: 4, color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', paddingHorizontal: theme.spacing.base },
  photoFallbackRow: { flexDirection: 'row', justifyContent: 'center', paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.5)' },
  photoFallbackBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  photoFallbackBtnText: { color: 'rgba(255,255,255,0.9)', marginLeft: 8, fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.warningSoft, padding: theme.spacing.sm, margin: theme.spacing.sm, borderRadius: 8 },
  bannerText: { marginLeft: theme.spacing.sm, color: theme.colors.textPrimary, fontSize: theme.typography.fontSize.sm, flex: 1 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  placeholderTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
  placeholderText: { marginTop: theme.spacing.xs, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.lg },
  button: { marginTop: theme.spacing.sm, ...theme.styles.button.primary, paddingHorizontal: theme.spacing.xl },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: theme.colors.primary },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
  buttonSecondaryText: { color: theme.colors.primary, fontWeight: theme.typography.fontWeight.semibold },
  buttonBack: { marginTop: theme.spacing.xl },
  buttonBackText: { color: theme.colors.textSecondary, fontSize: theme.typography.fontSize.sm },
  cameraFallback: { flex: 1, position: 'relative', backgroundColor: '#000' },
  cameraFallbackText: { color: '#fff', marginBottom: theme.spacing.base },
  captureOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingVertical: theme.spacing.xl, backgroundColor: 'rgba(0,0,0,0.5)' },
  torchBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  torchBtnOn: { backgroundColor: theme.colors.primary },
  torchLabel: { color: '#fff', marginLeft: 6, fontSize: theme.typography.fontSize.sm },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
});

const whiteResultStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, marginBottom: 8 },
  backBtn: { padding: theme.spacing.sm, minWidth: 44 },
  headerTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: '700', color: '#111' },
  latency: { fontSize: theme.typography.fontSize.sm, color: theme.colors.success, marginBottom: theme.spacing.sm, fontWeight: '600' },
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
});
