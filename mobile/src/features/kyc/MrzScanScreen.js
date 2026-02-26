import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { parseMrz } from '../../lib/mrz';
import { logger } from '../../utils/logger';
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

export default function MrzScanScreen({ navigation }) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const timeoutRef = useRef(null);
  const mounted = useRef(true);

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

  if (!MrzReaderView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.placeholder}>
          <Ionicons name="camera-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.placeholderText}>MRZ okuyucu yüklenemedi. Development build gerekli.</Text>
          <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
            <Text style={styles.buttonText}>Geri</Text>
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
      <View style={styles.cameraWrap}>
        <MrzReaderView
          style={styles.camera}
          docType={DocType.Passport}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)' },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.white },
  iconBtn: { padding: theme.spacing.sm },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1, width: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '90%', height: 120, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 8 },
  frameHint: { marginTop: theme.spacing.sm, color: 'rgba(255,255,255,0.9)', fontSize: theme.typography.fontSize.sm },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.warningLight, padding: theme.spacing.sm, margin: theme.spacing.sm, borderRadius: 8 },
  bannerText: { marginLeft: theme.spacing.sm, color: theme.colors.textPrimary, fontSize: theme.typography.fontSize.sm, flex: 1 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  placeholderText: { marginTop: theme.spacing.lg, color: theme.colors.textSecondary, textAlign: 'center' },
  button: { marginTop: theme.spacing.xl, ...theme.styles.button.primary, paddingHorizontal: theme.spacing.xl },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
});
