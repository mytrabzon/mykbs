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
  KeyboardAvoidingView,
  Platform,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_SIZE = SCREEN_WIDTH * 0.92;
const THUMB_SIZE = 72;

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
  const [showTitleField, setShowTitleField] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri erişimi gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5,
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
    setUploadProgress(0);
    setUploadStatus(images.length ? 'Resimler hazırlanıyor...' : 'Paylaşım gönderiliyor...');
    try {
      let imageUrls = [];
      const totalImages = images.length;
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const step = totalImages > 0 ? (i / totalImages) * 0.7 : 0;
        setUploadProgress(0.05 + step);
        setUploadStatus(totalImages > 1 ? `Resim yükleniyor (${i + 1}/${totalImages})...` : 'Resim yükleniyor...');
        try {
          let base64 = null;
          if (typeof img.base64 === 'string' && img.base64.length > 0) {
            base64 = img.base64.replace(/^data:image\/[^;]+;base64,/i, '');
            base64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
          }
          if (!base64 && img.uri) {
            base64 = await FileSystem.readAsStringAsync(img.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            if (typeof base64 === 'string') {
              base64 = base64.replace(/^data:image\/[^;]+;base64,/i, '');
              base64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
            }
          }
          if (!base64 || typeof base64 !== 'string') {
            Toast.show({ type: 'error', text1: 'Resim yüklenemedi', text2: 'Resim verisi alınamadı' });
            setLoading(false);
            setUploadProgress(0);
            setUploadStatus('');
            return;
          }
          const url = await communityApi.uploadCommunityImage(base64, branchId, token);
          imageUrls.push(url);
          setUploadProgress(0.05 + ((i + 1) / totalImages) * 0.7);
        } catch (e) {
          Toast.show({ type: 'error', text1: 'Resim yüklenemedi', text2: e?.message || 'Resim verisi işlenemedi' });
          setLoading(false);
          setUploadProgress(0);
          setUploadStatus('');
          return;
        }
      }
      setUploadProgress(0.9);
      setUploadStatus('Paylaşım gönderiliyor...');
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
      setUploadProgress(1);
      setUploadStatus('Tamamlandı');
      Toast.show({ type: 'success', text1: 'Paylaşım eklendi' });
      navigation.goBack();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: err?.message });
      setUploadProgress(0);
      setUploadStatus('');
    } finally {
      setLoading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  const mainImageUri = images[0]?.uri;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Yeni Paylaşım"
        tesis={tesis}
        onBack={() => navigation.goBack()}
        rightComponent={
          <TouchableOpacity
            onPress={handlePublish}
            disabled={loading || !body.trim()}
            style={[styles.headerShareBtn, (loading || !body.trim()) && styles.headerShareBtnDisabled]}
          >
            {!loading && <Text style={[styles.headerShareText, { color: colors.primary }]}>Paylaş</Text>}
          </TouchableOpacity>
        }
      />

      {loading && (
        <View style={[styles.progressSection, { backgroundColor: colors.surface }]}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${Math.min(100, Math.max(0, uploadProgress * 100))}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressStatus, { color: colors.textSecondary }]} numberOfLines={1}>
            {uploadStatus}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Instagram tarzı: önce büyük fotoğraf alanı */}
          <View style={[styles.photoSection, { backgroundColor: colors.surface }]}>
            {mainImageUri ? (
              <View style={styles.mainPreviewWrap}>
                <Image source={{ uri: mainImageUri }} style={styles.mainPreview} resizeMode="cover" />
                <TouchableOpacity
                  style={[styles.changePhotoBtn, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
                  onPress={pickImage}
                >
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.changePhotoText}>Değiştir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.photoPlaceholder, { borderColor: colors.border, backgroundColor: colors.background }]}
                onPress={pickImage}
              >
                <View style={[styles.photoPlaceholderIcon, { backgroundColor: colors.border }]}>
                  <Ionicons name="images-outline" size={48} color={colors.textSecondary} />
                </View>
                <Text style={[styles.photoPlaceholderText, { color: colors.textSecondary }]}>
                  Fotoğraf ekle
                </Text>
                <Text style={[styles.photoPlaceholderHint, { color: colors.textDisabled }]}>
                  Galeriden seç (en fazla 5)
                </Text>
              </TouchableOpacity>
            )}

            {/* Ek resimler küçük thumbnails */}
            {images.length > 1 && (
              <ScrollView
                horizontal
                style={styles.thumbsScroll}
                contentContainerStyle={styles.thumbsContent}
                showsHorizontalScrollIndicator={false}
              >
                {images.map((img, i) => (
                  <View key={i} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <TouchableOpacity
                      style={[styles.removeThumb, { backgroundColor: colors.error }]}
                      onPress={() => removeImage(i)}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity
                    style={[styles.addThumb, { borderColor: colors.border }]}
                    onPress={pickImage}
                  >
                    <Ionicons name="add" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>

          {/* Caption - Instagram tarzı metin alanı */}
          <View style={[styles.captionSection, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.captionInput, { color: colors.textPrimary }]}
              value={body}
              onChangeText={setBody}
              placeholder="Ne düşünüyorsun?"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              maxLength={2000}
            />
            {(showTitleField || title.trim()) && (
              <>
                <Text style={[styles.optionalLabel, { color: colors.textSecondary }]}>Başlık (isteğe bağlı)</Text>
                <TextInput
                  style={[styles.titleInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Başlık"
                  placeholderTextColor={colors.textSecondary}
                />
              </>
            )}
            {!showTitleField && !title.trim() && (
              <TouchableOpacity onPress={() => setShowTitleField(true)} style={styles.addTitleLink}>
                <Text style={[styles.addTitleText, { color: colors.primary }]}>+ Başlık ekle</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Kategori */}
          <View style={[styles.categorySection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Kategori</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, category === c.key && { backgroundColor: colors.primary }]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={[styles.chipText, { color: category === c.key ? '#fff' : colors.textSecondary }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  headerShareBtn: { paddingVertical: 8, paddingHorizontal: 12, minWidth: 60, alignItems: 'flex-end' },
  headerShareBtnDisabled: { opacity: 0.5 },
  headerShareText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },

  progressSection: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressStatus: {
    fontSize: 13,
  },

  photoSection: {
    padding: spacing.screenPadding,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  mainPreviewWrap: {
    width: PREVIEW_SIZE,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mainPreview: {
    width: '100%',
    height: PREVIEW_SIZE,
    borderRadius: 12,
  },
  changePhotoBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  changePhotoText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  photoPlaceholder: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE * 0.85,
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  photoPlaceholderText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: '500',
  },
  photoPlaceholderHint: {
    fontSize: typography.text.caption.fontSize,
    marginTop: 4,
  },
  thumbsScroll: { marginTop: 12 },
  thumbsContent: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  thumbWrap: { position: 'relative' },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 8 },
  removeThumb: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionSection: {
    padding: spacing.screenPadding,
    paddingTop: spacing.lg,
  },
  captionInput: {
    fontSize: typography.text.bodyLarge.fontSize,
    lineHeight: 24,
    minHeight: 100,
    padding: 0,
  },
  optionalLabel: { fontSize: typography.text.caption.fontSize, marginTop: 16, marginBottom: 6 },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.text.body.fontSize,
  },
  addTitleLink: { marginTop: 12 },
  addTitleText: { fontSize: typography.text.body.fontSize },

  categorySection: {
    padding: spacing.screenPadding,
    paddingTop: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.text.caption.fontSize,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontWeight: '500' },

  bottomPad: { height: 24 },
});
