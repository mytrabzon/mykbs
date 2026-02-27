import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
const STABLE_READ_COUNT = 3; // Aynı MRZ 3 kez üst üste okununca auto-capture

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

// iOS'ta sadece pasaport desteklenir (ID_CARD "Only passport document type is supported on iOS" hatası verir)
const DOC_TYPES = Platform.OS === 'ios'
  ? [{ key: 'passport', label: 'Pasaport', docType: 'PASSPORT' }]
  : [
      { key: 'passport', label: 'Pasaport', docType: 'PASSPORT' },
      { key: 'id', label: 'Ehliyet / Kimlik', docType: 'ID_CARD' },
    ];

export default function MrzScanScreen({ navigation }) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [docTypeKey, setDocTypeKey] = useState(Platform.OS === 'ios' ? 'passport' : 'passport');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showCameraFallback, setShowCameraFallback] = useState(false);
  const [lastMrzRaw, setLastMrzRaw] = useState('');
  const [stableReadCount, setStableReadCount] = useState(0);
  const [lastMrzChecksReason, setLastMrzChecksReason] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const [ocrLatencyMs, setOcrLatencyMs] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const timeoutRef = useRef(null);
  const mounted = useRef(true);
  const lastStableRawRef = useRef('');
  const stableCountRef = useRef(0);
  const [permission, requestPermission] = useCameraPermissions();


  const handleMRZRead = useCallback(
    (data) => {
      const raw = typeof data === 'string' ? data : (data?.nativeEvent?.mrz ?? data?.mrz ?? '');
      if (!raw || !mounted.current) return;
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
                { text: 'Manuel giriş', onPress: () => navigation.replace('KycManualEntry') },
              ]
            );
          }
          return next;
        });
        return;
      }
      setLastMrzChecksReason('');
      if (lastStableRawRef.current === raw) {
        stableCountRef.current += 1;
        setStableReadCount(stableCountRef.current);
        if (stableCountRef.current >= STABLE_READ_COUNT) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          navigation.replace('MrzResult', { payload });
        }
      } else {
        lastStableRawRef.current = raw;
        stableCountRef.current = 1;
        setStableReadCount(1);
      }
    },
    [navigation]
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
      setOcrLatencyMs(Date.now() - t0);
      setLastMrzRaw(raw.slice(0, 30) + '…');
      if (payload.checks?.ok) {
        navigation.replace('MrzResult', { payload });
      } else {
        setLastMrzChecksReason(payload.checks?.reason || 'invalid_format');
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: getFailureReasonMessage(payload.checks?.reason) });
      }
    },
    [navigation]
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
        else Toast.show({ type: 'error', text1: 'MRZ bulunamadı', text2: 'MRZ alanı görünür olsun.' });
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'MRZ okunamadı.' });
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
    await uploadImageForMrz(result.assets[0].uri);
  }, [uploadImageForMrz]);

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

  const selectedDocType = Platform.OS === 'ios' ? DocType.Passport : (docTypeKey === 'id' ? DocType.ID : DocType.Passport);

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
            onCapture={uploadImageForMrz}
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
          <Text style={styles.placeholderTitle}>Pasaport, Ehliyet veya Kimlik</Text>
          <Text style={styles.placeholderText}>MRZ alanını tarayın veya fotoğraf yükleyin.</Text>
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
      <View style={styles.docTypeRow}>
        {DOC_TYPES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.docTypeBtn, docTypeKey === key && styles.docTypeBtnActive]}
            onPress={() => setDocTypeKey(key)}
          >
            <Text style={[styles.docTypeBtnText, docTypeKey === key && styles.docTypeBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.cameraWrap}>
        <MrzReaderView
          style={styles.camera}
          docType={selectedDocType}
          cameraSelector={CameraSelector.Back}
          onMRZRead={handleMRZRead}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.frameHint}>MRZ alanını çerçeve içine alın</Text>
          {docTypeKey === 'id' && (
            <Text style={styles.frameHintSecondary}>Kimlik canlı okunmazsa aşağıdaki "Fotoğraf ile tara"yı kullanın</Text>
          )}
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
