/**
 * Kullanıcı detay — GET /api/app-admin/users/:id; Ban (disable), Unban (enable), Sil (delete).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../services/apiSupabase';
import Toast from 'react-native-toast-message';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const PADDING = 16;

export default function UserDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token } = useAuth();
  const userId = route.params?.userId;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const base = getBackendUrl();
    if (!base || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${base}/api/app-admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) setUser(json);
      else {
        Toast.show({ type: 'error', text1: json.message || 'Kullanıcı yüklenemedi' });
        navigation.goBack();
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message || 'Bağlantı hatası' });
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [userId, token, navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const apiPost = async (path, body = {}) => {
    const base = getBackendUrl();
    const r = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return r;
  };

  const handleDisable = () => {
    Alert.alert(
      'Kullanıcıyı banla',
      'Bu kullanıcı giriş yapamayacak. Devam edilsin mi?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Banla',
          style: 'destructive',
          onPress: async () => {
            setActing('disable');
            try {
              const r = await apiPost(`/api/app-admin/users/${userId}/disable`, { reason: 'Mobil admin' });
              const json = await r.json().catch(() => ({}));
              if (r.ok) {
                Toast.show({ type: 'success', text1: 'Kullanıcı banlandı' });
                load();
              } else Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
            } catch (e) {
              Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const handleEnable = async () => {
    setActing('enable');
    try {
      const r = await apiPost(`/api/app-admin/users/${userId}/enable`);
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Ban kaldırıldı' });
        load();
      } else Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
    } finally {
      setActing(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Kullanıcıyı sil',
      'Bu kullanıcı kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setActing('delete');
            try {
              const r = await apiPost(`/api/app-admin/users/${userId}/delete`);
              const json = await r.json().catch(() => ({}));
              if (r.ok) {
                Toast.show({ type: 'success', text1: 'Kullanıcı silindi' });
                navigation.goBack();
              } else Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
            } catch (e) {
              Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const headerPaddingTop = Platform.OS === 'ios' ? Math.max(insets.top, 12) : 12;
  const isDisabled = user?.profile?.is_disabled === true;

  if (loading && !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
          <TouchableOpacity hitSlop={HIT_SLOP} onPress={() => navigation.goBack()} style={[styles.headerBtn, styles.headerBtnBack, { backgroundColor: colors.background }]}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Kullanıcı</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!user) return null;

  const createdStr = user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  const lastSignStr = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
        <TouchableOpacity hitSlop={HIT_SLOP} onPress={() => navigation.goBack()} style={[styles.headerBtn, styles.headerBtnBack, { backgroundColor: colors.background }]}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Kullanıcı detayı</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>E-posta</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{user.email || '—'}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{user.phone || '—'}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Kayıt tarihi</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{createdStr}</Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Son giriş</Text>
          <Text style={[styles.value, { color: colors.textPrimary }]}>{lastSignStr}</Text>
          {user.profile && (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Rol / Onay</Text>
              <Text style={[styles.value, { color: colors.textPrimary }]}>
                {user.profile.role || '—'} · {user.profile.approval_status || '—'}
                {isDisabled ? ' · Banlı' : ''}
              </Text>
            </>
          )}
        </View>

        <View style={styles.actions}>
          {isDisabled ? (
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleEnable}
              disabled={!!acting}
            >
              {acting === 'enable' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
              <Text style={styles.btnText}>Banı kaldır</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={handleDisable}
              disabled={!!acting}
            >
              {acting === 'disable' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="ban" size={20} color="#fff" />}
              <Text style={styles.btnText}>Banla</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.btn, styles.btnDanger]}
            onPress={handleDelete}
            disabled={!!acting}
          >
            {acting === 'delete' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trash" size={20} color="#fff" />}
            <Text style={styles.btnText}>Kullanıcıyı sil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PADDING,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerBtnBack: { marginLeft: -44 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: PADDING },
  card: {
    padding: PADDING,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  label: { fontSize: 12, marginBottom: 4, marginTop: 12 },
  value: { fontSize: 16 },
  actions: { gap: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  btnPrimary: {},
  btnDanger: { backgroundColor: '#dc2626' },
  btnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
