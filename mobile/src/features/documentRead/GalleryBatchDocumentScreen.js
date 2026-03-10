/**
 * Galeriden 5–10 belge seçip POST /ocr/documents-batch ile toplu okut.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';
import { api } from '../../services/apiSupabase';

const MAX_SELECT = 10;

export default function GalleryBatchDocumentScreen({ navigation, route }) {
  const { colors } = useTheme();
  const docType = route?.params?.docType || 'kimlik';
  const [loading, setLoading] = useState(false);

  const pickAndUpload = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'Galeri izni gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType?.Images ?? 'images',
      allowsEditing: false,
      quality: 0.9,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const assets = result.assets.slice(0, MAX_SELECT);
    if (assets.length === 0) return;
    setLoading(true);
    try {
      const formData = new FormData();
      assets.forEach((a, i) => {
        formData.append('images', { uri: a.uri, type: 'image/jpeg', name: `doc_${i}.jpg` });
      });
      const { data } = await api.post('/ocr/documents-batch', formData);
      navigation.replace('DocumentBatchResult', { results: data?.results || [], docType });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Toplu okuma başarısız', text2: e?.message });
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>Toplu belge (5–10)</Text>
        <View style={styles.iconBtn} />
      </View>
      <View style={styles.centered}>
        <Ionicons name="images-outline" size={64} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          En fazla {MAX_SELECT} fotoğraf seçin. Hepsi sırayla okunup listelenecek.
        </Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={pickAndUpload} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Galeriden 5–10 seç</Text>}
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
  btn: { paddingVertical: 14, paddingHorizontal: theme.spacing.xl, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  btnBack: { marginTop: theme.spacing.lg },
  btnBackText: { fontSize: theme.typography.fontSize.sm },
});
