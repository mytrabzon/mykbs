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
import { api, getBackendUrl } from '../services/api';
import * as communityApi from '../services/communityApi';

const SAVE_TIMEOUT_MS = 30000;
function withTimeout(promise, ms, msg = 'İstek zaman aşımına uğradı') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { typography, spacing } from '../theme';

export default function ProfilDuzenleScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, tesis, getSupabaseToken } = useAuth();
  const [displayName, setDisplayName] = useState(() => (user?.adSoyad || '').trim());
  const [title, setTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const maxWait = 2500;
    const timeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, maxWait);
    (async () => {
      try {
        const t = await getSupabaseToken();
        if (t) {
          const me = await withTimeout(communityApi.getMe(t), 6000).catch(() => null);
          if (!cancelled) {
            if (me) {
              setDisplayName((me.display_name || user?.adSoyad || '').trim());
              setTitle(me.title || '');
              setAvatarUrl(me.avatar_url || null);
            } else if (user?.adSoyad) setDisplayName((user.adSoyad || '').trim());
          }
        } else {
          const res = await withTimeout(api.get('/auth/profile'), 6000).catch(() => null);
          const data = res?.data || {};
          if (!cancelled) {
            if (data.display_name != null || data.title != null || data.avatar_url != null) {
              setDisplayName((data.display_name || user?.adSoyad || '').trim());
              setTitle(data.title || '');
              setAvatarUrl(data.avatar_url || null);
            } else if (user?.adSoyad) setDisplayName((user.adSoyad || '').trim());
          }
        }
      } catch (_) {
        if (!cancelled && user?.adSoyad) setDisplayName((user.adSoyad || '').trim());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
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
    setSaving(true);
    try {
      const token = await getSupabaseToken();
      if (!token && !user) {
        Toast.show({ type: 'error', text1: 'Giriş gerekli', text2: 'Profil düzenlemek için giriş yapın.' });
        return;
      }

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

      const backendAvailable = !!getBackendUrl();

      if (backendAvailable) {
        await withTimeout(api.put('/auth/profile', body), SAVE_TIMEOUT_MS, 'Kayıt zaman aşımına uğradı. İnterneti kontrol edip tekrar deneyin.');
      } else {
        if (!token) {
          Toast.show({ type: 'error', text1: 'Kayıt yok', text2: 'Profil kaydetmek için sunucu adresi veya giriş gerekli.' });
          return;
        }
        let finalAvatarUrl = body.avatar_url;
        if (body.avatar_base64) {
          finalAvatarUrl = await withTimeout(communityApi.uploadAvatar(body.avatar_base64, token), SAVE_TIMEOUT_MS);
        }
        await withTimeout(
          communityApi.updateProfile({ display_name: body.display_name, avatar_url: finalAvatarUrl, title: body.title }, token),
          SAVE_TIMEOUT_MS
        );
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
