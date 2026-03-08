/**
 * Galeriden tek belge seçip base64 ile POST /ocr/document-base64 ile okut (FormData galeri URI sorununu aşar).
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';
import { api } from '../../services/apiSupabase';
import { logger } from '../../utils/logger';

export default function GallerySingleDocumentScreen({ navigation, route }) {
  const { colors } = useTheme();
  const docType = (route && route.params && route.params.docType) ? route.params.docType : 'kimlik';
  const [loading, setLoading] = useState(false);

  const pickAndUpload = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Galeri izni gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets || !result.assets[0] || !result.assets[0].uri) return;
    let uri = result.assets[0].uri;
    logger.info('[Galeri belge] Seçilen uri', { uri: uri?.slice(0, 80) + '…' });
    try {
      const Manipulator = require('expo-image-manipulator');
      if (Manipulator && typeof Manipulator.manipulateAsync === 'function') {
        const m = await Manipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], { compress: 0.8 });
        if (m?.uri) { uri = m.uri; logger.info('[Galeri belge] Resize sonrası uri', { uri: uri?.slice(0, 80) + '…' }); }
      }
    } catch (manipErr) {
      logger.warn('[Galeri belge] Resize atlandı', { err: manipErr?.message });
    }
    setLoading(true);
    try {
      let base64;
      try {
        base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      } catch (readErr) {
        if (uri.startsWith('content://') || uri.startsWith('file://')) {
          const cachePath = `${FileSystem.cacheDirectory}gallery_doc_${Date.now()}.jpg`;
          await FileSystem.copyAsync({ from: uri, to: cachePath });
          base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.deleteAsync(cachePath, { idempotent: true });
        } else {
          throw readErr;
        }
      }
      logger.info('[Galeri belge] Base64 hazır', { base64Len: base64?.length ?? 0 });
      const res = await api.post('/ocr/document-base64', { imageBase64: base64 });
      const data = res?.data;
      logger.info('[Galeri belge] Backend OK', { hasMrz: !!data?.mrz, hasMerged: !!data?.merged });
      navigation.replace('DocumentResult', { data, docType });
    } catch (e) {
      const msg = e?.message || String(e);
      const resMsg = e?.response?.data?.message || e?.response?.data?.error;
      const isNetwork = /network|fetch|bağlantı|connection|failed|sunucu/i.test(msg) || (e?.message && !e?.response);
      logger.error('[Galeri belge] API hatası', { message: msg, responseMessage: resMsg, status: e?.response?.status, stack: e?.stack?.slice(0, 400) });
      Toast.show({
        type: 'error',
        text1: isNetwork ? 'Bağlantı hatası' : 'Okuma başarısız',
        text2: isNetwork ? 'Backend\'e ulaşılamadı. İnternet ve giriş yapıldığından emin olun.' : (resMsg || msg || 'Belge okunamadı. Net bir fotoğraf seçin.'),
      });
    } finally {
      setLoading(false);
    }
  }, [navigation, docType]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Galeriden tek belge</Text>
        <View style={styles.iconBtn} />
      </View>
      <View style={styles.centered}>
        <Ionicons name="image-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>Tek bir fotoğraf seçin; MRZ ve ön yüz otomatik okunur.</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={pickAndUpload} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Galeriden seç</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
          <Text style={[styles.btnBackText, { color: colors.textSecondary }]}>Geri</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: '600' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  hint: { textAlign: 'center', marginBottom: theme.spacing.xl, fontSize: theme.typography.fontSize.sm },
  btn: { paddingVertical: 14, paddingHorizontal: theme.spacing.xl, borderRadius: 12, minWidth: 200, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnBack: { marginTop: theme.spacing.lg },
  btnBackText: { fontSize: theme.typography.fontSize.sm },
});
