import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { typography, spacing } from '../theme';

const CATEGORIES = [
  { key: 'general', label: 'Genel' },
  { key: 'experience', label: 'Deneyim' },
  { key: 'question', label: 'Soru' },
  { key: 'solution', label: 'Çözüm' },
  { key: 'procedure', label: 'Prosedür' },
  { key: 'warning', label: 'Uyarı' },
];

export default function PaylasimEkleScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { tesis, getSupabaseToken } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('general');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri erişimi gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets) {
      setImages((prev) => [...prev, ...result.assets.slice(0, 5 - prev.length)].slice(0, 5));
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const getBranchId = async () => {
    if (tesis?.id) return tesis.id;
    const t = await getSupabaseToken();
    if (!t) return null;
    const me = await communityApi.getMe(t);
    return me?.branch_id || null;
  };

  const handlePublish = async () => {
    const text = body.trim();
    if (!text) {
      Toast.show({ type: 'error', text1: 'Metin girin', text2: 'Paylaşım metni zorunludur' });
      return;
    }
    const branchId = await getBranchId();
    if (!branchId) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Tesis bilgisi alınamadı' });
      return;
    }
    const token = await getSupabaseToken();
    if (!token) {
      Toast.show({ type: 'error', text1: 'Giriş gerekli' });
      return;
    }
    setLoading(true);
    try {
      let imageUrls = [];
      for (const img of images) {
        try {
          let base64 = null;
          if (typeof img.base64 === 'string' && img.base64.length > 0) {
            base64 = img.base64.replace(/^data:image\/[^;]+;base64,/i, '').replace(/\s/g, '');
          }
          if (!base64 && img.uri) {
            base64 = await FileSystem.readAsStringAsync(img.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (typeof base64 === 'string') base64 = base64.replace(/\s/g, '');
          }
          if (!base64 || typeof base64 !== 'string') {
            Toast.show({ type: 'error', text1: 'Resim yüklenemedi', text2: 'Resim verisi alınamadı' });
            setLoading(false);
            return;
          }
          const url = await communityApi.uploadCommunityImage(base64, branchId, token);
          imageUrls.push(url);
        } catch (e) {
          Toast.show({ type: 'error', text1: 'Resim yüklenemedi', text2: e?.message || 'Resim verisi işlenemedi' });
          setLoading(false);
          return;
        }
      }
      await communityApi.createPost(
        {
          branch_id: branchId,
          type: 'post',
          title: title.trim() || undefined,
          body: text,
          category,
          media: imageUrls.length ? { images: imageUrls } : undefined,
        },
        token
      );
      Toast.show({ type: 'success', text1: 'Paylaşım eklendi' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: err?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Paylaşım Ekle"
        tesis={tesis}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Başlık (isteğe bağlı)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Başlık"
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Metin *</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={body}
              onChangeText={setBody}
              placeholder="Paylaşımınızı yazın..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Kategori</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, category === c.key && { backgroundColor: colors.primary }]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={[styles.chipText, { color: category === c.key ? '#fff' : colors.textSecondary }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Resimler (en fazla 5)</Text>
            <View style={styles.imageRow}>
              {images.map((img, i) => (
                <View key={i} style={styles.imageWrap}>
                  <Image source={{ uri: img.uri }} style={styles.thumb} />
                  <TouchableOpacity style={styles.removeImage} onPress={() => removeImage(i)}>
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 5 && (
                <TouchableOpacity style={[styles.addImage, { borderColor: colors.border }]} onPress={pickImage}>
                  <Ionicons name="add" size={32} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={handlePublish}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.btnText}>Paylaş</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.screenPadding, paddingBottom: 40 },
  card: { borderRadius: 16, padding: spacing.cardPadding, marginBottom: 24 },
  label: { fontSize: typography.text.caption.fontSize, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: typography.text.body.fontSize, marginBottom: 16 },
  inputMultiline: { minHeight: 100 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  chipText: { fontSize: 13 },
  imageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  removeImage: { position: 'absolute', top: -4, right: -4 },
  addImage: { width: 72, height: 72, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
