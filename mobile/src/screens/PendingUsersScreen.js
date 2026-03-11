/**
 * Onay Bekleyenler — Tüm veriler uygulama içinde, API: GET/POST /api/app-admin/...
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../services/apiSupabase';
import Toast from 'react-native-toast-message';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const PADDING = 16;

function PendingRow({ item, colors, onApprove, onReject, onDisable, acting }) {
  const loading = acting === item.user_id;
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.display_name || item.email || item.user_id?.slice(0, 8) || '—'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.email || '—'} {item.phone ? ` · ${item.phone}` : ''}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
          Rol: {item.role || '—'} · Beklemede
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
          onPress={() => onApprove(item.user_id)}
          disabled={loading}
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
          onPress={() => onReject(item.user_id)}
          disabled={loading}
        >
          <Ionicons name="close" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.textSecondary }]}
          onPress={() => onDisable(item.user_id)}
          disabled={loading}
        >
          <Ionicons name="ban" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function PendingUsersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setError(null);
    const base = getBackendUrl();
    if (!base || !token) {
      setError(base ? 'Oturum bulunamadı.' : 'Backend adresi tanımlı değil.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const r = await fetch(`${base}/api/app-admin/pending-users`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.message || 'Liste alınamadı');
        setUsers([]);
      } else {
        setUsers(json.users || []);
        setError(null);
      }
    } catch (e) {
      setError(e?.message || 'Bağlantı hatası');
      setUsers([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (userId) => {
    setActing(userId);
    const base = getBackendUrl();
    try {
      const r = await fetch(`${base}/api/app-admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Onaylandı' });
        setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      } else {
        Toast.show({ type: 'error', text1: json.message || 'Onay başarısız' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = (userId) => {
    Alert.alert('Reddet', 'Bu kullanıcıyı reddetmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Reddet',
        style: 'destructive',
        onPress: async () => {
          setActing(userId);
          const base = getBackendUrl();
          try {
            const r = await fetch(`${base}/api/app-admin/users/${userId}/reject`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ reason: 'Mobil üzerinden reddedildi' }),
            });
            if (r.ok) {
              Toast.show({ type: 'success', text1: 'Reddedildi' });
              setUsers((prev) => prev.filter((u) => u.user_id !== userId));
            } else {
              const json = await r.json().catch(() => ({}));
              Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
            }
          } catch (e) {
            Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  };

  const handleDisable = (userId) => {
    Alert.alert('Devre dışı bırak', 'Bu kullanıcıyı devre dışı bırakmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Devre dışı bırak',
        style: 'destructive',
        onPress: async () => {
          setActing(userId);
          const base = getBackendUrl();
          try {
            const r = await fetch(`${base}/api/app-admin/users/${userId}/disable`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: '{}',
            });
            if (r.ok) {
              Toast.show({ type: 'success', text1: 'Devre dışı bırakıldı' });
              setUsers((prev) => prev.filter((u) => u.user_id !== userId));
            } else {
              const json = await r.json().catch(() => ({}));
              Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
            }
          } catch (e) {
            Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  };

  const headerPaddingTop = Platform.OS === 'ios' ? Math.max(insets.top, 12) : 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          hitSlop={HIT_SLOP}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          style={[styles.headerBtn, { backgroundColor: colors.background }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Onay Bekleyenler</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && users.length === 0 && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      )}

      {error && users.length === 0 && !loading && (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && users.length === 0 && (
        <View style={styles.centerWrap}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Onay bekleyen kullanıcı yok</Text>
        </View>
      )}

      {users.length > 0 && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.user_id}
          renderItem={({ item }) => (
            <PendingRow
              item={item}
              colors={colors}
              onApprove={handleApprove}
              onReject={handleReject}
              onDisable={handleDisable}
              acting={acting}
            />
          )}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}
        />
      )}
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
  headerTitle: { fontSize: 18, fontWeight: '600' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  emptyText: { fontSize: 15, marginTop: 12 },
  listContent: { padding: PADDING, paddingTop: 12 },
  row: {
    padding: PADDING,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  rowMain: { marginBottom: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowMeta: { fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
