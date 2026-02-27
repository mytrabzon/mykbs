/**
 * Kamera test: netlik ve ışık kontrolü.
 * "Hiç okumuyor" yaşayan kullanıcı için pipeline'ın çalışıp çalışmadığını anlamak.
 * Dev Client + Vision Camera ile frame işleme bu ekranda genişletilebilir.
 */
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';

export default function CameraTestScreen({ navigation }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Kamera testi</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.msg, { color: colors.textPrimary }]}>Kamera izni gerekli</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            MRZ ve ön yüz okuma için kamera erişimi şart. İzin verin, sonra netlik ve ışığı bu ekrandan kontrol edebilirsiniz.
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
            <Text style={styles.btnText}>İzin ver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
            <Text style={[styles.btnBackText, { color: colors.textSecondary }]}>Geri</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.titleWhite}>Kamera testi</Text>
        <View style={styles.iconBtn} />
      </View>
      <CameraView
        style={StyleSheet.absoluteFill}
        onCameraReady={() => setReady(true)}
        enableTorch={torchOn}
      />
      <View style={styles.overlay}>
        <View style={styles.statusRow}>
          <View style={[styles.badge, ready ? styles.badgeOk : styles.badgePend]}>
            <Text style={styles.badgeText}>{ready ? 'Kamera hazır' : 'Yükleniyor…'}</Text>
          </View>
        </View>
        <Text style={styles.hintWhite}>
          Netlik ve ışık kontrolü. Belge okumanın çalıştığını görmek için "MRZ (arka)" veya "Ön yüz" ekranını kullanın.
        </Text>
        <Text style={styles.hintSmall}>
          Dev Client ile Vision Camera kullanıldığında frame işleme burada gösterilebilir.
        </Text>
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && { backgroundColor: theme.colors.primary }]}
          onPress={() => setTorchOn((v) => !v)}
        >
          <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={24} color="#fff" />
          <Text style={styles.torchLabel}>{torchOn ? 'Flaş kapat' : 'Flaş aç'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: '600' },
  titleWhite: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: '#fff' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  msg: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', marginTop: theme.spacing.base },
  hint: { textAlign: 'center', marginTop: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
  btnText: { color: '#fff', fontWeight: '600' },
  btnBack: { marginTop: theme.spacing.lg },
  btnBackText: { fontSize: theme.typography.fontSize.sm },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: theme.spacing.lg, paddingBottom: 40, backgroundColor: 'rgba(0,0,0,0.6)' },
  statusRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: theme.spacing.sm },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeOk: { backgroundColor: 'rgba(16,185,129,0.9)' },
  badgePend: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hintWhite: { color: 'rgba(255,255,255,0.95)', fontSize: theme.typography.fontSize.sm, textAlign: 'center', marginBottom: 8 },
  hintSmall: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textAlign: 'center', marginBottom: theme.spacing.base },
  torchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  torchLabel: { color: '#fff', marginLeft: 8, fontSize: theme.typography.fontSize.sm },
});
