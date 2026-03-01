/**
 * Scan camera: overlay + live feedback + auto-capture.
 * Uses expo-camera; can be swapped to react-native-vision-camera for frame processor.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../../context/ThemeContext';
import type { ScanDocType } from './scan.types';
import { scanLogger } from './scan.logger';
import { scanStore } from './scan.store';
import { computeFrameScores, getQualityHint } from './scan.quality';
import { createAutoCaptureMachine } from './scan.autocapture';
import { postScanMrzParse } from './scan.api';
import { postScanDocParse } from './scan.api';

export default function ScanCameraScreen({ navigation }: { navigation: any }) {
  const route = useRoute();
  const docType = (route.params?.docType || 'passport') as ScanDocType;
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [capturing, setCapturing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const machineRef = useRef(createAutoCaptureMachine());
  const correlationId = scanStore.getState().correlationId || `scan_${Date.now()}`;

  useFocusEffect(
    useCallback(() => {
      scanStore.setCaptureState('SEARCHING');
      machineRef.current.reset();
      return () => {};
    }, [])
  );

  useEffect(() => {
    if (!permission?.granted) requestPermission?.();
  }, [permission, requestPermission]);

  const processPhoto = useCallback(
    async (base64: string) => {
      scanStore.setCaptureState('PROCESSING');
      scanLogger.photo_captured({ correlationId, docType });
      try {
        if (docType === 'passport') {
          // On-device MRZ would run here if we had Vision/ML Kit OCR; for now always backend
          scanLogger.backend_parse_requested({ correlationId });
          const res = await postScanMrzParse(base64, 'passport', correlationId);
          scanLogger.backend_parse_done({ correlationId, ok: res.ok, confidence: res.confidence });
          navigation.replace('ScanReview', {
            docType,
            imageBase64: base64,
            result: { mrz: res },
            correlationId,
          });
        } else {
          const docTypeApi = docType === 'tr_id' ? 'tr_id_front' : 'tr_dl_front';
          scanLogger.backend_parse_requested({ correlationId });
          const res = await postScanDocParse(base64, docTypeApi, correlationId);
          scanLogger.backend_parse_done({ correlationId, ok: res.ok, confidence: res.confidence });
          navigation.replace('ScanReview', {
            docType,
            imageBase64: base64,
            result: { doc: res },
            correlationId,
          });
        }
      } catch (e) {
        scanLogger.scan_failed({ correlationId, errorCode: 'parse_error' });
        Alert.alert('Hata', (e as Error).message || 'Okuma başarısız');
        scanStore.setCaptureState('SEARCHING');
      } finally {
        setCapturing(false);
      }
    },
    [docType, correlationId, navigation]
  );

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.85,
        skipProcessing: true,
      });
      if (photo?.base64) {
        await processPhoto(photo.base64);
      } else {
        setCapturing(false);
      }
    } catch (e) {
      setCapturing(false);
      Alert.alert('Hata', (e as Error).message || 'Fotoğraf alınamadı');
    }
  }, [capturing, processPhoto]);

  // Quality hint from stub scores (with VisionCamera would use real frame scores)
  useEffect(() => {
    const scores = computeFrameScores();
    setHint(getQualityHint(scores));
  }, []);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.permissionCard, { backgroundColor: colors.background }]}>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>Kamera izni gerekli</Text>
        <TouchableOpacity onPress={requestPermission} style={[styles.btn, { backgroundColor: colors.primary }]}>
          <Text style={styles.btnText}>İzin ver</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
          <Text style={[styles.btnBackText, { color: colors.textSecondary }]}>Geri</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
      <SafeAreaView style={styles.overlay} edges={['top']}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>
        {hint ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        ) : null}
      </SafeAreaView>
      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <Text style={styles.footerText}>
          {docType === 'passport' ? 'Pasaport veya kimlik MRZ alanını çerçeveye alın' : 'Belge ön yüzünü çerçeveye alın'}
        </Text>
        {capturing ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <TouchableOpacity onPress={takePhoto} style={styles.captureBtn} activeOpacity={0.8}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  permissionCard: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  permissionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  btnBack: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24 },
  btnBackText: { fontSize: 16, fontWeight: '600' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  backBtn: { padding: 8 },
  hintBox: { flex: 1, marginLeft: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  hintText: { color: '#fff', fontSize: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingBottom: 24 },
  footerText: { color: '#fff', marginBottom: 16, fontSize: 14 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  captureInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff' },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '600' },
});
