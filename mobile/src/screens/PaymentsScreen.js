/**
 * Paketler & Ödemeler (Satışlar) — Tüm veriler uygulama içinde, API: GET/POST /api/app-admin/satislar
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

function SiparisRow({ item, colors, onOdendi, onIptal, acting }) {
  const loading = acting === item.id;
  const tarih = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const durumColor = item.durum === 'odendi' ? '#22c55e' : item.durum === 'iptal' ? '#ef4444' : colors.textSecondary;
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.siparisNo || `#${item.id}`}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.tesis?.tesisAdi || item.tesisId || '—'} · {item.paket || '—'}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowMetaText, { color: colors.textSecondary }]}>
            {tarih} · {item.tutarTL != null ? `${item.tutarTL} TL` : '—'}
          </Text>
          <Text style={[styles.rowDurum, { color: durumColor }]}>{item.durum || '—'}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {item.durum === 'pending' && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
            onPress={() => onOdendi(item.id)}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={18} color="#fff" />}
          </TouchableOpacity>
        )}
        {(item.durum === 'pending' || item.durum === 'odendi') && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
            onPress={() => onIptal(item.id)}
            disabled={loading}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="close" size={18} color="#fff" />}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function PaymentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { token } = useAuth();
  const [siparisler, setSiparisler] = useState([]);
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
      const r = await fetch(`${base}/api/app-admin/satislar?limit=100`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.message || 'Satışlar alınamadı');
        setSiparisler([]);
      } else {
        setSiparisler(json.siparisler || []);
        setError(null);
      }
    } catch (e) {
      setError(e?.message || 'Bağlantı hatası');
      setSiparisler([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOdendi = async (id) => {
    setActing(id);
    const base = getBackendUrl();
    try {
      const r = await fetch(`${base}/api/app-admin/satislar/${id}/odendi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Ödeme kaydedildi' });
        load(true);
      } else {
        Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message || 'İşlem başarısız' });
    } finally {
      setActing(null);
    }
  };

  const handleIptal = (id) => {
    Alert.alert(
      'Sipariş iptal',
      'Bu siparişi iptal etmek istediğinize emin misiniz? Ödenmiş siparişte tesis bildirim kotası iptal edilen paket kadar düşürülür.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal et',
          style: 'destructive',
          onPress: async () => {
            setActing(id);
            const base = getBackendUrl();
            try {
              const r = await fetch(`${base}/api/app-admin/satislar/${id}/iptal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: '{}',
              });
              const json = await r.json().catch(() => ({}));
              if (r.ok) {
                Toast.show({ type: 'success', text1: json.message || 'Sipariş iptal edildi', text2: json.kotaDusurulen != null ? `Kota ${json.kotaDusurulen} adet düşürüldü` : undefined });
                load(true);
              } else {
                Toast.show({ type: 'error', text1: json.message || 'İşlem başarısız' });
              }
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          hitSlop={HIT_SLOP}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          style={[styles.headerBackWrap, { backgroundColor: colors.background }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          <Text style={[styles.headerBackText, { color: colors.textPrimary }]}>Geri</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Paketler & Ödemeler</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && siparisler.length === 0 && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      )}

      {error && siparisler.length === 0 && !loading && (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && siparisler.length === 0 && (
        <View style={styles.centerWrap}>
          <Ionicons name="cash-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Henüz sipariş yok</Text>
        </View>
      )}

      {siparisler.length > 0 && (
        <FlatList
          data={siparisler}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <SiparisRow
              item={item}
              colors={colors}
              onOdendi={handleOdendi}
              onIptal={handleIptal}
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
    paddingHorizontal: PADDING,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerBackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 8,
  },
  headerBackText: { fontSize: 16, marginLeft: 4, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '600', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 80, minWidth: 80 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  emptyText: { fontSize: 15, marginTop: 12 },
  listContent: { padding: PADDING, paddingTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PADDING,
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
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
