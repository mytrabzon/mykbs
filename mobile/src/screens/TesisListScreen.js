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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../services/apiSupabase';
import { getIsAdminPanelUser, getEffectiveRole } from '../utils/adminAuth';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const CARD_PADDING = 16;

function TesisRow({ item, colors }) {
  const kotaText = item.kota != null && item.kullanilanKota != null
    ? `${item.kullanilanKota}/${item.kota}`
    : '—';
  const durumColor = item.durum === 'aktif' ? '#4CAF50' : colors.textSecondary;
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.tesisAdi || '—'}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.yetkiliAdSoyad || '—'} {item.il ? `· ${item.il}` : ''}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowMetaText, { color: colors.textSecondary }]}>
            {item.paket || '—'} · Kota: {kotaText}
          </Text>
          <Text style={[styles.rowDurum, { color: durumColor }]}>{item.durum || '—'}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </View>
  );
}

export default function TesisListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const isAdmin = getIsAdminPanelUser(user) || getEffectiveRole(user) === 'admin';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [tesisler, setTesisler] = useState([]);

  const fetchTesisler = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setError(null);
    const base = getBackendUrl();
    if (!base) {
      setError('Backend adresi tanımlı değil.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!token) {
      setError('Oturum bulunamadı.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const r = await fetch(`${base}/api/admin/tesisler?limit=100`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.message || 'Tesis listesi alınamadı');
        setTesisler([]);
      } else {
        setTesisler(json.tesisler || []);
        setError(null);
      }
    } catch (e) {
      setError(e?.message || 'Bağlantı hatası');
      setTesisler([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    if (isAdmin) fetchTesisler();
  }, [isAdmin, fetchTesisler]);

  const onRefresh = () => {
    fetchTesisler(true);
  };

  const headerPaddingTop = Platform.OS === 'ios' ? Math.max(insets.top, 12) : 12;

  if (!isAdmin) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          hitSlop={HIT_SLOP}
          activeOpacity={0.7}
          style={[styles.headerBtn, { backgroundColor: colors.background }]}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Tesis Listesi</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && tesisler.length === 0 && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      )}

      {error && tesisler.length === 0 && !loading && (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            hitSlop={HIT_SLOP}
            activeOpacity={0.7}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchTesisler()}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryBtnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && tesisler.length === 0 && (
        <View style={styles.centerWrap}>
          <Ionicons name="business-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz tesis yok</Text>
        </View>
      )}

      {tesisler.length > 0 && (
        <FlatList
          data={tesisler}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <TesisRow item={item} colors={colors} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
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
    paddingHorizontal: CARD_PADDING,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  emptyText: { fontSize: 15, marginTop: 12 },
  listContent: { padding: CARD_PADDING, paddingTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: CARD_PADDING,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  rowMain: { flex: 1, marginRight: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  rowMetaText: { fontSize: 12 },
  rowDurum: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
