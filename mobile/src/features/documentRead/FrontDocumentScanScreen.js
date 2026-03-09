/**
 * Ön yüz belge fotoğrafı: kamera ile çek, POST /ocr/document ile MRZ + ön yüz OCR al.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { api } from '../../services/apiSupabase';

export default function FrontDocumentScanScreen({ navigation, route }) {
  const docType = route?.params?.docType || 'kimlik';
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraOpenFailed, setCameraOpenFailed] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const cameraReadyTimeoutRef = useRef(null);

  // Kamera 8 sn içinde hazır olmazsa "açılamadı" göster
  useEffect(() => {
    if (!permission?.granted || cameraReady || cameraOpenFailed) return;
    cameraReadyTimeoutRef.current = setTimeout(() => {
      cameraReadyTimeoutRef.current = null;
      setCameraOpenFailed(true);
    }, 8000);
    return () => {
      if (cameraReadyTimeoutRef.current) {
        clearTimeout(cameraReadyTimeoutRef.current);
        cameraReadyTimeoutRef.current = null;
      }
    };
  }, [permission?.granted, cameraReady, cameraOpenFailed]);

  const captureAndUpload = useCallback(async () => {
    if (!cameraRef.current || loading) return;
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Toast.show({ type: 'error', text1: 'Kamera izni gerekli' });
        return;
      }
    }
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        Toast.show({ type: 'error', text1: 'Fotoğraf alınamadı' });
        setLoading(false);
        return;
      }
      const formData = new FormData();
      formData.append('image', { uri: photo.uri, type: 'image/jpeg', name: 'front.jpg' });
      const { data } = await api.post('/ocr/document', formData);
      setLoading(false);
      navigation.replace('DocumentResult', { data, docType });
    } catch (e) {
      setLoading(false);
      Toast.show({ type: 'error', text1: 'Okuma başarısız', text2: e?.message || 'Belge okunamadı.' });
    }
  }, [loading, permission, requestPermission, navigation, docType]);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.centeredText}>Kamera izni gerekli</Text>
          <TouchableOpacity style={styles.btn} onPress={requestPermission}>
            <Text style={styles.btnText}>İzin ver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
            <Text style={styles.btnBackText}>Geri</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Ön yüz oku</Text>
        <View style={styles.iconBtn} />
      </View>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => {
          if (cameraReadyTimeoutRef.current) {
            clearTimeout(cameraReadyTimeoutRef.current);
            cameraReadyTimeoutRef.current = null;
          }
          setCameraReady(true);
          setCameraOpenFailed(false);
        }}
        onMountError={(e) => {
          setCameraReady(false);
          setCameraOpenFailed(true);
          Toast.show({ type: 'error', text1: 'Kamera açılamadı', text2: e?.nativeEvent?.message || 'Tekrar deneyin.' });
        }}
      />
      {!cameraReady && !cameraOpenFailed ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.hint}>Kamera hazırlanıyor…</Text>
        </View>
      ) : null}
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {cameraOpenFailed ? 'Kamera açılamadı. Geri dönüp tekrar deneyin.' : 'Belgenin ön yüzünü çerçeve içine alıp çekin'}
        </Text>
        <TouchableOpacity style={styles.captureBtn} onPress={captureAndUpload} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="camera" size={40} color="#fff" />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)' },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: '#fff' },
  iconBtn: { padding: theme.spacing.sm },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  frame: { position: 'absolute', top: '20%', width: '85%', aspectRatio: 1.586, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 12 },
  hint: { color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm, marginBottom: 24 },
  captureBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  centeredText: { color: '#fff', marginBottom: theme.spacing.base },
  btn: { ...theme.styles.button.primary, paddingHorizontal: theme.spacing.xl },
  btnText: { color: '#fff', fontWeight: '600' },
  btnBack: { marginTop: theme.spacing.lg },
  btnBackText: { color: 'rgba(255,255,255,0.8)', fontSize: theme.typography.fontSize.sm },
});
