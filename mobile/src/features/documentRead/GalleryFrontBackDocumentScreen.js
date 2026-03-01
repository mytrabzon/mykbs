/**
 * Galeriden belge ön + arka yüz seçip POST /ocr/document-front-back ile okut.
 * Ön yüz: fotoğraf ve ad/soyad/TC olan yüz. Arka yüz: MRZ çizgileri olan yüz.
 * Tüm bilgiler tam ve doğru birleştirilir (MRZ arka, OCR ön).
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';
import { api } from '../../services/apiSupabase';
import { logger } from '../../utils/logger';

const resizeUri = async (uri) => {
  try {
    const Manipulator = require('expo-image-manipulator');
    if (Manipulator?.manipulateAsync) {
      const m = await Manipulator.manipulateAsync(uri, [{ resize: { width: 2000 } }], { compress: 0.9 });
      if (m?.uri) return m.uri;
    }
  } catch (_) {}
  return uri;
};

/** Galeriden content:// URI okunamıyorsa önce cache'e kopyala (Android). */
const readUriAsBase64 = async (uri) => {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch (readErr) {
    if (uri.startsWith('content://') || uri.startsWith('file://')) {
      const cachePath = `${FileSystem.cacheDirectory}gallery_fb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: cachePath });
      const base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: FileSystem.EncodingType.Base64 });
      await FileSystem.deleteAsync(cachePath, { idempotent: true });
      return base64;
    }
    throw readErr;
  }
};

export default function GalleryFrontBackDocumentScreen({ navigation, route }) {
  const { colors } = useTheme();
  const docType = route?.params?.docType || 'kimlik';
  const [frontUri, setFrontUri] = useState(null);
  const [backUri, setBackUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = useCallback(async (side) => {
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
    if (result.canceled || !result.assets?.[0]?.uri) return;
    let uri = result.assets[0].uri;
    uri = await resizeUri(uri);
    if (side === 'front') setFrontUri(uri);
    else setBackUri(uri);
  }, []);

  const clearSide = useCallback((side) => {
    if (side === 'front') setFrontUri(null);
    else setBackUri(null);
  }, []);

  const submit = useCallback(async () => {
    if (!frontUri || !backUri) {
      Toast.show({ type: 'error', text1: 'Ön ve arka yüzü seçin', text2: 'Her iki fotoğraf da gerekli.' });
      return;
    }
    setLoading(true);
    try {
      const [frontBase64, backBase64] = await Promise.all([
        readUriAsBase64(frontUri),
        readUriAsBase64(backUri),
      ]);
      logger.info('[Galeri ön+arka] Gönderiliyor', { frontLen: frontBase64?.length ?? 0, backLen: backBase64?.length ?? 0 });
      const res = await api.post('/ocr/document-front-back', { frontBase64, backBase64 });
      const data = res?.data;
      logger.info('[Galeri ön+arka] OK', { hasMerged: !!data?.merged });
      navigation.replace('DocumentResult', { data, docType });
    } catch (e) {
      const msg = e?.message || String(e);
      const resMsg = e?.response?.data?.message || e?.response?.data?.error;
      const isNetwork = /network|fetch|bağlantı|connection|failed|sunucu/i.test(msg) || (e?.message && !e?.response);
      logger.error('[Galeri ön+arka] API hatası', { message: msg, responseMessage: resMsg });
      Toast.show({
        type: 'error',
        text1: isNetwork ? 'Bağlantı hatası' : 'Okuma başarısız',
        text2: isNetwork ? 'Backend\'e ulaşılamadı. İnternet ve giriş kontrol edin.' : (resMsg || msg || 'Belge okunamadı. Net fotoğraflar seçin.'),
      });
    } finally {
      setLoading(false);
    }
  }, [frontUri, backUri, navigation, docType]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Ön + arka yüz</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Önce ön yüzü (fotoğraf ve ad/soyad/TC), sonra arka yüzü (MRZ çizgileri) seçin. Tüm bilgiler birleştirilerek okunur.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>Ön yüz (fotoğraf + bilgiler)</Text>
          {frontUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: frontUri }} style={styles.preview} resizeMode="contain" />
              <TouchableOpacity style={[styles.changeBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage('front')}>
                <Text style={styles.changeBtnText}>Değiştir</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.pickArea, { borderColor: colors.border }]} onPress={() => pickImage('front')}>
              <Ionicons name="image-outline" size={48} color={colors.primary} />
              <Text style={[styles.pickAreaText, { color: colors.textSecondary }]}>Ön yüzü seç</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>Arka yüz (MRZ çizgileri)</Text>
          {backUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: backUri }} style={styles.preview} resizeMode="contain" />
              <TouchableOpacity style={[styles.changeBtn, { backgroundColor: colors.primary }]} onPress={() => pickImage('back')}>
                <Text style={styles.changeBtnText}>Değiştir</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.pickArea, { borderColor: colors.border }]} onPress={() => pickImage('back')}>
              <Ionicons name="document-text-outline" size={48} color={colors.primary} />
              <Text style={[styles.pickAreaText, { color: colors.textSecondary }]}>Arka yüzü seç</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: frontUri && backUri ? colors.primary : colors.border },
          ]}
          onPress={submit}
          disabled={!frontUri || !backUri || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Belgeyi oku</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnBack} onPress={() => navigation.goBack()}>
          <Text style={[styles.btnBackText, { color: colors.textSecondary }]}>Geri</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
  },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: '600' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 40 },
  hint: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.fontSize.sm,
  },
  card: {
    borderRadius: 16,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  cardLabel: { fontSize: theme.typography.fontSize.sm, fontWeight: '600', marginBottom: 10 },
  pickArea: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  pickAreaText: { marginTop: 8, fontSize: theme.typography.fontSize.sm },
  previewWrap: { alignItems: 'center' },
  preview: { width: '100%', height: 180, borderRadius: 12 },
  changeBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  changeBtnText: { color: '#fff', fontWeight: '600', fontSize: theme.typography.fontSize.sm },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
    alignSelf: 'center',
    marginTop: theme.spacing.base,
  },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  btnBack: { marginTop: theme.spacing.lg, alignSelf: 'center' },
  btnBackText: { fontSize: theme.typography.fontSize.sm },
});
