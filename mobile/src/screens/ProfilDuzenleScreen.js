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
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api, getBackendUrl } from '../services/api';
import { getApiBaseUrl, isSupabaseConfigured } from '../config/api';
import { backendHealth } from '../services/backendHealth';
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
  const { user, tesis, isLoggedIn, getSupabaseToken, refreshMe } = useAuth();
  const [displayName, setDisplayName] = useState(() => (user?.adSoyad || '').trim());
  const [title, setTitle] = useState('');
  const [telefon, setTelefon] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarUrlTs, setAvatarUrlTs] = useState(0);
  const [localAvatarUri, setLocalAvatarUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ configured: false, isOnline: null, error: null });
  const [supabaseStatus, setSupabaseStatus] = useState({ configured: false, isOnline: null, error: null });

  useEffect(() => {
    const backendUrl = getApiBaseUrl();
    const supabaseCfg = isSupabaseConfigured();
    setBackendStatus((prev) => ({ ...prev, configured: !!backendUrl }));
    setSupabaseStatus((prev) => ({ ...prev, configured: supabaseCfg }));
    const updateBackend = (status) => setBackendStatus({ configured: !!backendUrl, isOnline: status.isOnline, error: status.error });
    const updateSupabase = (status) => setSupabaseStatus({ configured: status.configured, isOnline: status.isOnline, error: status.error });
    backendHealth.checkHealth().then(updateBackend);
    if (supabaseCfg) backendHealth.checkSupabaseHealth().then(updateSupabase);
    const unsubBackend = backendHealth.onStatusChange(updateBackend);
    const unsubSupabase = backendHealth.onSupabaseStatusChange(updateSupabase);
    return () => {
      if (typeof unsubBackend === 'function') unsubBackend();
      if (typeof unsubSupabase === 'function') unsubSupabase();
    };
  }, []);

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
          const me = await withTimeout(communityApi.getMe(t), 6000).catch((e) => {
            console.warn('[ProfilDuzenle] getMe hatası:', e?.message);
            return null;
          });
          if (!cancelled) {
            if (me) {
              console.log('[ProfilDuzenle] Profil yüklendi (Supabase/me):', { display_name: me.display_name?.slice(0, 40), title: me.title?.slice(0, 40), hasAvatar: !!me.avatar_url });
              setDisplayName((me.display_name || user?.adSoyad || '').trim());
              setTitle(me.title || '');
              setAvatarUrl(me.avatar_url || null);
            } else if (user?.adSoyad) setDisplayName((user.adSoyad || '').trim());
            if (user?.telefon && user.telefon !== '-') setTelefon(user.telefon.replace(/^\+\d*/, '').replace(/\D/g, '').replace(/^0?/, '') || '');
          }
        } else {
          const res = await withTimeout(api.get('/auth/profile'), 6000).catch((e) => {
            console.warn('[ProfilDuzenle] GET /auth/profile hatası:', e?.message, e?.response?.status);
            return null;
          });
          const data = res?.data || {};
          if (!cancelled) {
            console.log('[ProfilDuzenle] Profil yüklendi (backend):', { display_name: data.display_name?.slice(0, 40), title: data.title?.slice(0, 40), hasAvatar: !!data.avatar_url, telefon: data.telefon ? '(var)' : null });
            if (data.display_name != null || data.title != null || data.avatar_url != null || data.telefon != null) {
              setDisplayName((data.display_name || user?.adSoyad || '').trim());
              setTitle(data.title || '');
              setAvatarUrl(data.avatar_url || null);
              if (data.telefon) setTelefon(data.telefon.replace(/^\+\d*/, '').replace(/\D/g, '').replace(/^0?/, '') || '');
            } else if (user?.adSoyad) setDisplayName((user.adSoyad || '').trim());
            if ((user?.telefon && user.telefon !== '-') && !data.telefon) setTelefon(user.telefon.replace(/^\+\d*/, '').replace(/\D/g, '').replace(/^0?/, '') || '');
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
      let uri = result.assets[0].uri;
      try {
        const Manipulator = require('expo-image-manipulator');
        if (Manipulator?.manipulateAsync) {
          const m = await Manipulator.manipulateAsync(uri, [{ resize: { width: 800 } }], { compress: 0.8 });
          if (m?.uri) uri = m.uri;
        }
      } catch (_) {}
      setLocalAvatarUri(uri);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const backendAvailable = !!getBackendUrl();
      const token = await getSupabaseToken();
      console.log('[ProfilDuzenle] Kaydet başladı:', {
        isLoggedIn,
        backendAvailable,
        hasToken: !!token,
        displayName: displayName?.slice(0, 40),
        title: title?.slice(0, 40),
        hasLocalAvatar: !!localAvatarUri,
        localAvatarUri: localAvatarUri ? localAvatarUri.slice(0, 60) + '...' : null,
      });

      if (!isLoggedIn) {
        console.warn('[ProfilDuzenle] Kaydet iptal: giriş yok');
        Toast.show({ type: 'error', text1: 'Giriş gerekli', text2: 'Profil düzenlemek için giriş yapın.' });
        setSaving(false);
        return;
      }

      if (!backendAvailable && !token) {
        console.warn('[ProfilDuzenle] Kaydet iptal: ne backend ne Supabase token yok');
        Toast.show({ type: 'error', text1: 'Profil düzenleme', text2: 'E-posta veya telefon ile giriş yaparak profil düzenleyebilirsiniz.' });
        setSaving(false);
        return;
      }

      const body = {
        display_name: displayName.trim() || null,
        title: title.trim() || null,
        telefon: telefon.trim() ? telefon.trim().replace(/\D/g, '') : '',
        avatar_url: avatarUrl || null,
      };
      if (localAvatarUri) {
        let base64;
        try {
          base64 = await FileSystem.readAsStringAsync(localAvatarUri, { encoding: FileSystem.EncodingType.Base64 });
        } catch (readErr) {
          if (localAvatarUri.startsWith('content://') || localAvatarUri.startsWith('file://')) {
            try {
              const cachePath = `${FileSystem.cacheDirectory}avatar_${Date.now()}.jpg`;
              await FileSystem.copyAsync({ from: localAvatarUri, to: cachePath });
              base64 = await FileSystem.readAsStringAsync(cachePath, { encoding: FileSystem.EncodingType.Base64 });
              await FileSystem.deleteAsync(cachePath, { idempotent: true });
            } catch (copyErr) {
              Toast.show({ type: 'error', text1: 'Profil resmi okunamadı', text2: 'Görseli tekrar seçin veya farklı bir fotoğraf deneyin.' });
              setSaving(false);
              return;
            }
          } else {
            Toast.show({ type: 'error', text1: 'Profil resmi okunamadı', text2: readErr?.message || 'Görseli tekrar seçin.' });
            setSaving(false);
            return;
          }
        }
        if (typeof base64 === 'string') {
          base64 = base64.replace(/^data:image\/[^;]+;base64,/i, '').replace(/[^A-Za-z0-9+/=]/g, '');
        }
        if (base64 && base64.length > 0) {
          body.avatar_base64 = base64;
          console.log('[ProfilDuzenle] Avatar base64 eklendi, uzunluk:', base64.length);
        } else {
          console.warn('[ProfilDuzenle] Avatar base64 boş veya geçersiz');
          Toast.show({ type: 'error', text1: 'Profil resmi boş', text2: 'Başka bir görsel seçin.' });
          setSaving(false);
          return;
        }
      }

      console.log('[ProfilDuzenle] Gönderilecek body (avatar_base64 hariç):', {
        display_name: body.display_name,
        title: body.title,
        hasAvatarUrl: !!body.avatar_url,
        hasAvatarBase64: !!body.avatar_base64,
      });

      if (backendAvailable) {
        console.log('[ProfilDuzenle] Backend PATCH /auth/profile çağrılıyor');
        const res = await withTimeout(api.put('/auth/profile', body), SAVE_TIMEOUT_MS, 'Kayıt zaman aşımına uğradı. İnterneti kontrol edip tekrar deneyin.');
        const data = res?.data;
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        if (typeof refreshMe === 'function') await refreshMe();
        console.log('[ProfilDuzenle] Backend profil kaydı tamamlandı');
      } else {
        if (!token) {
          Toast.show({ type: 'error', text1: 'Profil kaydedilemedi', text2: 'Çıkış yapıp tekrar giriş yapın.' });
          setSaving(false);
          return;
        }
        let finalAvatarUrl = body.avatar_url;
        if (body.avatar_base64) {
          finalAvatarUrl = await withTimeout(communityApi.uploadAvatar(body.avatar_base64, token), SAVE_TIMEOUT_MS);
        }
        console.log('[ProfilDuzenle] Supabase path: updateProfile çağrılıyor', { display_name: body.display_name, title: body.title, hasFinalAvatar: !!finalAvatarUrl });
        await withTimeout(
          communityApi.updateProfile({ display_name: body.display_name, avatar_url: finalAvatarUrl, title: body.title }, token),
          SAVE_TIMEOUT_MS
        );
        if (finalAvatarUrl) {
          setAvatarUrl(finalAvatarUrl);
          setAvatarUrlTs(Date.now());
        }
        if (typeof refreshMe === 'function') await refreshMe();
        console.log('[ProfilDuzenle] Supabase profil kaydı tamamlandı');
      }

      Toast.show({ type: 'success', text1: 'Profil kaydedildi' });
      navigation.goBack();
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const msg = err?.message || (data?.message) || 'Kaydedilemedi';
      console.error('[ProfilDuzenle] Kaydet hatası:', {
        message: err?.message,
        status,
        code: data?.code,
        dataMessage: data?.message,
        stack: err?.stack?.slice(0, 200),
      });
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
  const avatarDisplayUri = localAvatarUri || (avatarUrl ? `${avatarUrl}${avatarUrlTs ? `?t=${avatarUrlTs}` : ''}` : null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Profil Düzenle"
        tesis={tesis}
        onBack={() => navigation.goBack()}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('Ayarlar')}
        backendConfigured={backendStatus.configured}
        backendOnline={backendStatus.isOnline}
        backendError={backendStatus.error}
        supabaseConfigured={supabaseStatus.configured}
        supabaseOnline={supabaseStatus.isOnline}
        supabaseError={supabaseStatus.error}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Avatar</Text>
          <TouchableOpacity onPress={pickAvatar} style={[styles.avatarWrap, { backgroundColor: colors.background }]}>
            {showAvatar ? (
              <Image source={{ uri: avatarDisplayUri }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={48} color={colors.textSecondary} />
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          {(user?.email || (user?.telefon && user.telefon !== '-')) ? (
            <View style={styles.accountRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Hesap (giriş: e-posta)</Text>
              <Text style={[styles.accountValue, { color: colors.textSecondary }]} numberOfLines={1}>
                {user?.email || user?.telefon}
              </Text>
            </View>
          ) : null}
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon (isteğe bağlı)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
            value={telefon}
            onChangeText={(t) => setTelefon(t.replace(/\D/g, '').slice(0, 11))}
            placeholder="5XX XXX XX XX"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
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
  accountRow: { marginBottom: 16 },
  accountValue: { fontSize: typography.text.body.fontSize },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: typography.text.body.fontSize, marginBottom: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
