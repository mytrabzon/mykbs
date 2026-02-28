import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { typography, spacing } from '../theme';

export default function ProfilDuzenleScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, tesis, getSupabaseToken } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);
    (async () => {
      try {
        const t = await getSupabaseToken();
        if (t) {
          const me = await communityApi.getMe(t);
          if (!cancelled) {
            setDisplayName(me?.display_name || '');
            setTitle(me?.title || '');
            setAvatarUrl(me?.avatar_url || null);
          }
        } else {
          const res = await api.get('/auth/profile');
          const data = res?.data || {};
          if (!cancelled) {
            setDisplayName(data.display_name || user?.adSoyad || '');
            setTitle(data.title || '');
            setAvatarUrl(data.avatar_url || null);
          }
        }
      } catch (_) {
        if (!cancelled && user?.adSoyad) setDisplayName(user.adSoyad);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [getSupabaseToken, user?.adSoyad]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Toast.show({ type: 'error', text1: 'İzin gerekli', text2: 'Galeri erişimi gerekli' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const token = await getSupabaseToken();
    if (!token && !user) {
      Toast.show({ type: 'error', text1: 'Giriş gerekli', text2: 'Profil düzenlemek için giriş yapın.' });
      return;
    }
    setSaving(true);
    try {
      if (token) {
        let finalAvatarUrl = avatarUrl;
        if (localAvatarUri) {
          let base64 = await FileSystem.readAsStringAsync(localAvatarUri, { encoding: FileSystem.EncodingType.Base64 });
          if (typeof base64 === 'string') {
            base64 = base64.replace(/^data:image\/[^;]+;base64,/i, '').replace(/[^A-Za-z0-9+/=]/g, '');
          }
          if (!base64 || base64.length === 0) {
            Toast.show({ type: 'error', text1: 'Resim okunamadı' });
            setSaving(false);
            return;
          }
          finalAvatarUrl = await communityApi.uploadAvatar(base64, token);
        }
        await communityApi.updateProfile(
          { display_name: displayName.trim() || null, avatar_url: finalAvatarUrl || null, title: title.trim() || null },
          token
        );
      } else {
        const body = {
          display_name: displayName.trim() || null,
          title: title.trim() || null,
          avatar_url: avatarUrl || null,
        };
        if (localAvatarUri) {
          let base64 = await FileSystem.readAsStringAsync(localAvatarUri, { encoding: FileSystem.EncodingType.Base64 });
          if (typeof base64 === 'string') {
            base64 = base64.replace(/^data:image\/[^;]+;base64,/i, '').replace(/[^A-Za-z0-9+/=]/g, '');
          }
          if (base64 && base64.length > 0) body.avatar_base64 = base64;
        }
        await api.put('/auth/profile', body);
      }
      Toast.show({ type: 'success', text1: 'Profil kaydedildi' });
      navigation.goBack();
    } catch (err) {
      const msg = err?.message || (err?.response?.data?.message) || 'Kaydedilemedi';
      Toast.show({ type: 'error', text1: 'Kaydedilemedi', text2: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const showAvatar = localAvatarUri || avatarUrl;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Profil Düzenle"
        tesis={tesis}
        onBack={() => navigation.goBack()}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('Ayarlar')}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Avatar</Text>
          <TouchableOpacity onPress={pickAvatar} style={[styles.avatarWrap, { backgroundColor: colors.background }]}>
            {showAvatar ? (
              <Image source={{ uri: localAvatarUri || avatarUrl }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={48} color={colors.textSecondary} />
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad / Görünen ad</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Adınız"
            placeholderTextColor={colors.textSecondary}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ünvan / Pozisyon</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Resepsiyon, Ön Büro Müdürü..."
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.btnText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.screenPadding, paddingBottom: 40 },
  card: { borderRadius: 16, padding: spacing.cardPadding, marginBottom: 24 },
  label: { fontSize: typography.text.caption.fontSize, marginBottom: 6 },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: typography.text.body.fontSize, marginBottom: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
