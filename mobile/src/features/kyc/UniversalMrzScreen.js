/**
 * KBS Prime - Evrensel MRZ Ekranı (Sıfırdan, özgün sistem)
 * Kamera çekimi veya galeriden görüntü seçimi -> backend /universal-mrz/read -> MrzResult
 * Hiçbir dış MRZ SDK kullanılmaz.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { useUniversalMrzReader } from './hooks/useUniversalMrzReader';

const LABEL = 'Evrensel MRZ (TD1/TD2/TD3)';

export default function UniversalMrzScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { readMrz, isReading, progress, error } = useUniversalMrzReader();
  const [pickedImage, setPickedImage] = useState(null);

  const handleGaleri = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Galeri erişimi için izin verin.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setPickedImage(uri);
    try {
      const data = await readMrz(uri, {});
      if (data.success && data.payload) {
        Toast.show({ type: 'success', text1: 'MRZ okundu', text2: `${data.format} formatı` });
        navigation.navigate('MrzResult', {
          payload: data.payload,
          photoUri: uri,
          scanDurationMs: 0,
        });
      } else {
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: data?.error || 'Belge net değil veya MRZ görünmüyor.' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.error || e?.message || 'Sunucu hatası' });
    } finally {
      setPickedImage(null);
    }
  }, [readMrz, navigation]);

  const handleKamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin gerekli', 'Kamera erişimi için izin verin.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setPickedImage(uri);
    try {
      const data = await readMrz(uri, {});
      if (data.success && data.payload) {
        Toast.show({ type: 'success', text1: 'MRZ okundu', text2: `${data.format} formatı` });
        navigation.navigate('MrzResult', {
          payload: data.payload,
          photoUri: uri,
          scanDurationMs: 0,
        });
      } else {
        Toast.show({ type: 'error', text1: 'MRZ okunamadı', text2: data?.error || 'Belge net değil.' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.error || e?.message || 'Sunucu hatası' });
    } finally {
      setPickedImage(null);
    }
  }, [readMrz, navigation]);

  const handleGeri = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGeri} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          <Text style={styles.backText}>Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{LABEL}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Ionicons name="document-text-outline" size={48} color={theme.colors.primary} style={styles.icon} />
          <Text style={styles.subtitle}>Pasaport, kimlik veya vize</Text>
          <Text style={styles.hint}>
            Galeriden belge fotoğrafı seçin veya kamerayla çekin. MRZ (alt 2–3 satır) net görünsün.
          </Text>
        </View>

        {isReading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.progressText}>{progress}</Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, styles.primary]}
          onPress={handleGaleri}
          disabled={isReading}
          activeOpacity={0.8}
        >
          <Ionicons name="images-outline" size={22} color="#fff" />
          <Text style={styles.buttonText}>Galeriden seç</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.outline]}
          onPress={handleKamera}
          disabled={isReading}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-outline" size={22} color={theme.colors.primary} />
          <Text style={styles.buttonOutlineText}>Kamera ile çek</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Tüm dünya pasaportları (TD3), T.C. kimlik (TD1), ehliyet/vize (TD2) desteklenir. Fotokopi ve ekran görüntüsü için otomatik ön işleme uygulanır.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: -4 },
  backText: { fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary, marginLeft: 4 },
  title: { flex: 1, textAlign: 'center', fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: theme.colors.textPrimary },
  placeholder: { width: 72 },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  card: {
    ...theme.styles.card,
    marginBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  icon: { marginBottom: theme.spacing.sm },
  subtitle: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
  hint: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'center' },
  loadingWrap: { alignItems: 'center', marginVertical: theme.spacing.lg },
  progressText: { marginTop: 8, fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary },
  errorText: { color: theme.colors.error, marginBottom: theme.spacing.sm, fontSize: theme.typography.fontSize.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: 12,
    marginBottom: theme.spacing.sm,
  },
  primary: { ...theme.styles.button.primary },
  outline: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  buttonText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: '600' },
  buttonOutlineText: { color: theme.colors.primary, fontSize: theme.typography.fontSize.base, fontWeight: '600' },
  footer: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
});
