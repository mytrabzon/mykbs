/**
 * QR kod ile oda seçimi — Her odada QR kod, okutunca direkt oda seçilsin.
 * QR içeriği: "KBS_ROOM_<odaId>" veya "KBS_ROOM_<odaNumarasi>" veya sadece oda numarası.
 */
import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../theme';
import { dataService } from '../services/dataService';
import { hapticSuccess } from '../utils/feedback';
import { logger } from '../utils/logger';

const MIN_TOUCH_SIZE = 60;

export default function QRRoomScanScreen({ navigation, route }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [odalar, setOdalar] = useState([]);
  const [loading, setLoading] = useState(true);
  const scannedRef = useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    dataService.getOdalar('tumu', false).then((list) => {
      if (!cancelled) setOdalar(list || []);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const findRoom = useCallback((data) => {
    const raw = (data || '').trim();
    if (!raw) return null;
    // "KBS_ROOM_101" veya "KBS_ROOM_uuid" veya "101"
    const match = raw.match(/KBS_ROOM_(.+)/i) || raw.match(/room[:_](\w+)/i);
    const key = match ? match[1].trim() : raw;
    const byNum = odalar.find((o) => String(o.odaNumarasi) === String(key));
    if (byNum) return byNum;
    const byId = odalar.find((o) => String(o.id) === String(key));
    return byId || null;
  }, [odalar]);

  const onBarcodeScanned = useCallback(({ data }) => {
    if (scannedRef.current) return;
    const oda = findRoom(data);
    if (!oda) {
      logger.warn('QR room not found', { data });
      return;
    }
    scannedRef.current = true;
    hapticSuccess();
    const fromCheckIn = route.params?.fromCheckIn;
    if (fromCheckIn) {
      navigation.replace('CheckIn', { selectedOda: oda });
    } else {
      navigation.replace('CheckIn', { selectedOda: oda });
    }
  }, [findRoom, navigation, route.params?.fromCheckIn]);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { minWidth: MIN_TOUCH_SIZE, minHeight: MIN_TOUCH_SIZE }]}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>QR ile oda seç</Text>
          <View style={{ width: MIN_TOUCH_SIZE }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="qr-code-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.msg, { color: colors.textPrimary }]}>Kamera izni gerekli</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Odadaki QR kodu okutmak için kamera erişimine izin verin.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, minHeight: MIN_TOUCH_SIZE }]}
            onPress={requestPermission}
          >
            <Text style={styles.primaryBtnText}>İzin ver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { minWidth: MIN_TOUCH_SIZE, minHeight: MIN_TOUCH_SIZE }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.titleWhite}>Oda QR kodunu okutun</Text>
        <View style={{ width: MIN_TOUCH_SIZE }} />
      </View>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scannedRef.current ? undefined : onBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hintWhite}>
          Odadaki QR kodu kare içine alın. Oda otomatik seçilir.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '600' },
  titleWhite: { fontSize: 18, fontWeight: '600', color: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  msg: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  primaryBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.spacing.borderRadius.base,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 48,
    alignItems: 'center',
  },
  frame: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    right: '15%',
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12,
  },
  hintWhite: { color: 'rgba(255,255,255,0.9)', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
});
