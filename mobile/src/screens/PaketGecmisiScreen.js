/**
 * Paket & Kredi geçmişi — Tesisin sipariş geçmişi, kalan kredi, toplam harcama.
 * API: GET /api/siparis → { siparisler, ozet: { kalanKredi, kullanilanKredi, toplamKota, toplamHarcamaTL, odendiAdet } }
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
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiSupabase';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const PADDING = 16;

const PAKET_LABEL = { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };

function SiparisRow({ item, colors }) {
  const tarih = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const durumLabel = item.durum === 'odendi' ? 'Ödendi' : item.durum === 'iptal' ? 'İptal' : 'Beklemede';
  const durumColor = item.durum === 'odendi' ? '#22c55e' : item.durum === 'iptal' ? '#ef4444' : colors.textSecondary;
  const paketAd = PAKET_LABEL[item.paket] || item.paket || '—';
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.siparisNo || `#${item.id}`}
        </Text>
        <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
          {paketAd} · {item.kredi != null ? `${item.kredi} bildirim` : '—'}
        </Text>
        <View style={styles.rowMeta}>
          <Text style={[styles.rowMetaText, { color: colors.textSecondary }]}>
            {tarih} · {item.tutarTL != null ? `${Number(item.tutarTL).toLocaleString('tr-TR')} ₺` : '—'}
          </Text>
          <Text style={[styles.rowDurum, { color: durumColor }]}>{durumLabel}</Text>
        </View>
      </View>
    </View>
  );
}

export default function PaketGecmisiScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [siparisler, setSiparisler] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setError(null);
    try {
      const { data } = await api.get('/siparis');
      setSiparisler(data.siparisler || []);
      setOzet(data.ozet || null);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSiparisler([]);
      setOzet(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const headerPaddingTop = Platform.OS === 'ios' ? Math.max(insets.top, 12) : 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          hitSlop={HIT_SLOP}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          style={[styles.headerBtn, styles.headerBtnBack, { backgroundColor: colors.background }]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Paket & Kredi Geçmişi</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && !ozet && siparisler.length === 0 && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      )}

      {error && !ozet && siparisler.length === 0 && !loading && (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => load()}>
            <Text style={styles.retryBtnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {(ozet != null || siparisler.length > 0) && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[colors.primary]} />}
          showsVerticalScrollIndicator={false}
        >
          {ozet != null && (
            <View style={[styles.ozetWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.ozetTitle, { color: colors.textPrimary }]}>Kredi durumu</Text>
              <View style={styles.ozetGrid}>
                <View style={[styles.ozetCard, { backgroundColor: colors.primarySoft || colors.background }]}>
                  <Ionicons name="wallet-outline" size={22} color={colors.primary} />
                  <Text style={[styles.ozetValue, { color: colors.textPrimary }]}>
                    {ozet.kalanKredi != null ? ozet.kalanKredi.toLocaleString('tr-TR') : '—'}
                  </Text>
                  <Text style={[styles.ozetLabel, { color: colors.textSecondary }]}>Kalan bildirim</Text>
                </View>
                <View style={[styles.ozetCard, { backgroundColor: colors.primarySoft || colors.background }]}>
                  <Ionicons name="checkmark-done-outline" size={22} color={colors.primary} />
                  <Text style={[styles.ozetValue, { color: colors.textPrimary }]}>
                    {ozet.kullanilanKredi != null ? ozet.kullanilanKredi.toLocaleString('tr-TR') : '—'}
                  </Text>
                  <Text style={[styles.ozetLabel, { color: colors.textSecondary }]}>Kullanılan</Text>
                </View>
              </View>
              <View style={[styles.ozetRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.ozetRowLabel, { color: colors.textSecondary }]}>Toplam kota</Text>
                <Text style={[styles.ozetRowValue, { color: colors.textPrimary }]}>
                  {ozet.toplamKota != null ? ozet.toplamKota.toLocaleString('tr-TR') : '—'} bildirim
                </Text>
              </View>
              <View style={[styles.ozetRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.ozetRowLabel, { color: colors.textSecondary }]}>Toplam harcama</Text>
                <Text style={[styles.ozetRowValue, { color: colors.primary }]}>
                  {ozet.toplamHarcamaTL != null ? `${Number(ozet.toplamHarcamaTL).toLocaleString('tr-TR')} ₺` : '—'}
                </Text>
              </View>
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Sipariş geçmişi</Text>
          {siparisler.length === 0 ? (
            <View style={[styles.emptyList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="receipt-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>Henüz sipariş yok</Text>
            </View>
          ) : (
            siparisler.map((item) => (
              <SiparisRow key={item.id} item={item} colors={colors} />
            ))
          )}
        </ScrollView>
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
  headerBtnBack: { marginLeft: -44 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorText: { fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: PADDING, paddingTop: 12 },
  ozetWrap: {
    borderRadius: 16,
    borderWidth: 1,
    padding: PADDING,
    marginBottom: 20,
  },
  ozetTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  ozetGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  ozetCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  ozetValue: { fontSize: 20, fontWeight: '700', marginTop: 6 },
  ozetLabel: { fontSize: 12, marginTop: 2 },
  ozetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  ozetRowLabel: { fontSize: 14 },
  ozetRowValue: { fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10 },
  emptyList: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  emptyListText: { fontSize: 15, marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: PADDING,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  rowMetaText: { fontSize: 12 },
  rowDurum: { fontSize: 12, fontWeight: '600' },
});
