import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { parseMrz } from '../../lib/mrz';
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

const TIMEOUT_MS = 10000;
const MAX_FAILS = 3;

const DOC_TYPES = [
  { key: 'passport', label: 'Pasaport', docType: 'PASSPORT' },
  { key: 'id', label: 'Ehliyet / Kimlik', docType: 'ID_CARD' },
];

export default function MrzScanScreen({ navigation }) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [docTypeKey, setDocTypeKey] = useState('passport');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showCameraFallback, setShowCameraFallback] = useState(false);
  const timeoutRef = useRef(null);
  const mounted = useRef(true);
  const [permission, requestPermission] = useCameraPermissions();


  const handleMRZRead = useCallback(
    (data) => {
      const raw = typeof data === 'string' ? data : (data?.nativeEvent?.mrz ?? data?.mrz ?? '');
      if (!raw || !mounted.current) return;
      const payload = parseMrz(raw);
      if (payload.checks?.ok) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        navigation.replace('MrzResult', { payload });
      } else {
        setFailCount((c) => {
          const next = c + 1;
          if (next >= MAX_FAILS) {
            Alert.alert(
              'Okunamadı',
              'Manuel giriş ile devam edebilirsiniz (NFC için gerekli alanlar).',
              [
                { text: 'Tekrar dene', onPress: () => setFailCount(0) },
                { text: 'Manuel giriş', onPress: () => navigation.replace('KycManualEntry') },
              ]
            );
          }
          return next;
        });
      }
    },
    [navigation]
  );

  const processMrzRaw = useCallback(
    (raw) => {
      if (!raw || !mounted.current) return;
      const payload = parseMrz(raw);
      if (payload.checks?.ok) {
        navigation.replace('MrzResult', { payload });
      } else {
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: 'Belgeyi net tutun veya manuel girin.' });
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

  const selectedDocType = docTypeKey === 'id' ? DocType.ID : DocType.Passport;

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
        <Text style={styles.title}>MRZ Tara</Text>
        <TouchableOpacity onPress={() => setHelpVisible(true)} style={styles.iconBtn}>
          <Ionicons name="help-circle-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
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
        </View>
      </View>
      {timeoutWarning && (
        <View style={styles.banner}>
          <Ionicons name="warning-outline" size={20} color={theme.colors.warning} />
          <Text style={styles.bannerText}>Işık, odak veya hiza kontrol edin. İpucu için ? tuşuna basın.</Text>
        </View>
      )}
      <ScanHelpSheet visible={helpVisible} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

function CameraFallbackView({ onCapture, onBack, loading, permission, requestPermission }) {
  const cameraRef = useRef(null);
  const [ready, setReady] = useState(false);

  const capture = async () => {
    if (!cameraRef.current || loading) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: false });
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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} onCameraReady={() => setReady(true)} />
      <View style={styles.captureOverlay}>
        <Text style={styles.frameHint}>MRZ alanını çerçeve içine alıp fotoğraf çekin</Text>
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
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.white },
  iconBtn: { padding: theme.spacing.sm },
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
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.warningLight, padding: theme.spacing.sm, margin: theme.spacing.sm, borderRadius: 8 },
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
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
});
