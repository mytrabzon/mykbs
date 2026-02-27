import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getIsAdminPanelUser } from '../utils/adminAuth';
import { getBackendUrl } from '../services/apiSupabase';
import { logger } from '../utils/logger';
import Toast from 'react-native-toast-message';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const CARD_PADDING = 16;
const SECTION_GAP = 20;

function StatCard({ iconName, iconBg, iconColor, value, label }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
      <View style={[styles.statCardIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={22} color={iconColor} />
      </View>
      <Text style={[styles.statCardValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statCardLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function SectionCard({ title, children, actionLabel, onAction }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
      <View style={styles.sectionCardHeader}>
        <Text style={[styles.sectionCardTitle, { color: colors.textPrimary }]}>{title}</Text>
        {onAction && (
          <TouchableOpacity
            hitSlop={HIT_SLOP}
            activeOpacity={0.7}
            onPress={onAction}
            style={[styles.sectionCardAction, { borderColor: colors.primary }]}
          >
            <Text style={[styles.sectionCardActionText, { color: colors.primary }]}>{actionLabel}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, last }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.dataRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[styles.dataRowLabel, { color: colors.textPrimary }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.dataRowValue, { color: colors.textSecondary }]}>{value}</Text>
    </View>
  );
}

export default function AdminPanelScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const isAdmin = getIsAdminPanelUser(user);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [requestLoading, setRequestLoading] = useState(false);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setError(null);
    const base = getBackendUrl();
    if (!base) {
      setError('Backend adresi tanımlı değil. EXPO_PUBLIC_BACKEND_URL ayarlayın.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (!token) {
        setError('Oturum bulunamadı. Tekrar giriş yapın.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const r = await fetch(`${base}/api/app-admin/dashboard`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = json.message || 'Dashboard yüklenemedi';
        if (r.status === 503 && (msg.includes('Supabase') || msg.includes('yapılandır'))) {
          setError('Admin paneli için sunucuda Supabase yapılandırması gerekiyor.');
        } else {
          setError(msg);
        }
        setData(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setData(json);
    } catch (e) {
      logger.error('Admin dashboard fetch', e);
      setError(e?.message || 'Bağlantı hatası. İnterneti kontrol edin.');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const fetchRequests = useCallback(async () => {
    const base = getBackendUrl();
    if (!base || !token) return;
    setRequestLoading(true);
    try {
      const r = await fetch(`${base}/api/app-admin/requests?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) setRequests(json.requests || []);
    } catch (_) {
      setRequests([]);
    } finally {
      setRequestLoading(false);
    }
  }, [token]);

  const approveRequest = async (id) => {
    const base = getBackendUrl();
    if (!base || !token) return;
    try {
      const r = await fetch(`${base}/api/app-admin/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Onaylandı' });
        fetchRequests();
      } else {
        Toast.show({ type: 'error', text1: json.message || 'Onaylanamadı' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message || 'Hata' });
    }
  };

  const rejectRequest = async (id) => {
    const base = getBackendUrl();
    if (!base || !token) return;
    try {
      const r = await fetch(`${base}/api/app-admin/requests/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        Toast.show({ type: 'success', text1: 'Reddedildi' });
        fetchRequests();
      } else {
        Toast.show({ type: 'error', text1: json.message || 'Reddedilemedi' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message || 'Hata' });
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      navigation.navigate('Odalar');
    }
  }, [isAdmin, navigation]);

  useEffect(() => {
    if (isAdmin) fetchDashboard();
  }, [isAdmin, fetchDashboard]);

  useEffect(() => {
    if (isAdmin && data) fetchRequests();
  }, [isAdmin, data, fetchRequests]);

  const handleRefresh = () => {
    fetchDashboard(true);
    Toast.show({ type: 'info', text1: 'Yenileniyor...' });
  };

  const handleBack = () => navigation.goBack();

  if (!isAdmin) return null;

  const headerPaddingTop = Platform.OS === 'ios' ? Math.max(insets.top, 12) : 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, paddingTop: headerPaddingTop, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          hitSlop={HIT_SLOP}
          activeOpacity={0.7}
          style={[styles.headerBtn, { backgroundColor: colors.background }]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Admin Paneli</Text>
        <TouchableOpacity
          hitSlop={HIT_SLOP}
          activeOpacity={0.7}
          style={[styles.headerBtn, { backgroundColor: colors.background }]}
          onPress={handleRefresh}
          disabled={loading && !data}
        >
          <Ionicons name="refresh" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading && !data && (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      )}

      {error && !data && (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>Hata</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity
            hitSlop={HIT_SLOP}
            activeOpacity={0.7}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchDashboard()}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryBtnText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {data && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Özet kartları */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Özet</Text>
          <View style={styles.statRow}>
            <StatCard
              iconName="business-outline"
              iconBg="#4361EE20"
              iconColor="#4361EE"
              value={data.toplamTesis ?? 0}
              label="Toplam Tesis"
            />
            <StatCard
              iconName="checkmark-circle-outline"
              iconBg="#4CAF5020"
              iconColor="#4CAF50"
              value={data.aktifTesis ?? 0}
              label="Aktif Tesis"
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              iconName="notifications-outline"
              iconBg="#FF980020"
              iconColor="#FF9800"
              value={data.gunlukBildirim ?? 0}
              label="Günlük Bildirim"
            />
            <StatCard
              iconName="warning-outline"
              iconBg="#F4433620"
              iconColor="#F44336"
              value={data.gunlukHata ?? 0}
              label="Günlük Hata"
            />
          </View>

          {/* KBS Tesis Bilgisi Talepleri */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>KBS Talepleri (Onay Bekleyen)</Text>
          <SectionCard title={`${requests.length} talep`} actionLabel={requestLoading ? '...' : 'Yenile'} onAction={requestLoading ? undefined : fetchRequests}>
            {requests.length === 0 && !requestLoading && (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Bekleyen talep yok</Text>
            )}
            {requests.map((req) => (
              <View key={req.id} style={[styles.requestRow, { borderBottomColor: colors.border }]}>
                <View style={styles.requestInfo}>
                  <Text style={[styles.requestAction, { color: colors.textPrimary }]}>{req.action === 'create' ? 'Yeni' : req.action === 'update' ? 'Güncelleme' : 'Silme'}</Text>
                  <Text style={[styles.requestMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                    Tesis kodu: {req.tesis_kodu || '—'} • {req.created_at ? new Date(req.created_at).toLocaleDateString('tr-TR') : ''}
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity onPress={() => approveRequest(req.id)} style={[styles.requestBtn, { backgroundColor: colors.success || '#22c55e' }]}>
                    <Text style={styles.requestBtnText}>Onayla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => rejectRequest(req.id)} style={[styles.requestBtn, { backgroundColor: colors.error }]}>
                    <Text style={styles.requestBtnText}>Reddet</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </SectionCard>

          {/* Hızlı işlemler */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Hızlı İşlemler</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              hitSlop={HIT_SLOP}
              activeOpacity={0.7}
              style={[styles.menuRow, { borderBottomColor: colors.border }]}
              onPress={handleRefresh}
            >
              <Ionicons name="refresh" size={22} color={colors.primary} />
              <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>Verileri yenile</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={HIT_SLOP}
              activeOpacity={0.7}
              style={[styles.menuRow, { borderBottomWidth: 0 }]}
              onPress={() => navigation.navigate('TesisList')}
            >
              <Ionicons name="list" size={22} color={colors.primary} />
              <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>Tesis listesi</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Paket dağılımı */}
          {data.paketDagilimi && Object.keys(data.paketDagilimi).length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Paket dağılımı</Text>
              <SectionCard title="Aktif tesislerde paket sayıları">
                {Object.entries(data.paketDagilimi).map(([paket, count], i, arr) => (
                  <Row key={paket} label={paket} value={String(count)} last={i === arr.length - 1} />
                ))}
              </SectionCard>
            </>
          )}

          {/* Kota aşımı */}
          {data.kotaAsimi && data.kotaAsimi.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Kota aşımı</Text>
              <SectionCard title="Kota limitine ulaşan tesisler">
                {data.kotaAsimi.map((t, i, arr) => (
                  <Row
                    key={t.id}
                    label={t.tesisAdi}
                    value={`${t.kullanilanKota}/${t.kota}`}
                    last={i === arr.length - 1}
                  />
                ))}
              </SectionCard>
            </>
          )}

          {data && (!data.paketDagilimi || Object.keys(data.paketDagilimi).length === 0) && (!data.kotaAsimi || data.kotaAsimi.length === 0) && (
            <View style={[styles.emptySection, { backgroundColor: colors.surface }]}>
              <Ionicons name="stats-chart-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }]}>Henüz ek veri yok</Text>
            </View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 15 },
  errorTitle: { fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 6 },
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
  scroll: { flex: 1 },
  scrollContent: { padding: CARD_PADDING, paddingTop: SECTION_GAP },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: CARD_PADDING,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  statCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statCardValue: { fontSize: 22, fontWeight: '700' },
  statCardLabel: { fontSize: 12, marginTop: 2 },
  sectionCard: {
    borderRadius: 16,
    padding: CARD_PADDING,
    marginBottom: SECTION_GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionCardTitle: { fontSize: 16, fontWeight: '600' },
  sectionCardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionCardActionText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 14, paddingVertical: 12 },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  requestInfo: { flex: 1, marginRight: 12 },
  requestAction: { fontSize: 15, fontWeight: '600' },
  requestMeta: { fontSize: 12, marginTop: 2 },
  requestActions: { flexDirection: 'row', gap: 8 },
  requestBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  requestBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dataRowLabel: { flex: 1, fontSize: 15 },
  dataRowValue: { fontSize: 15, fontWeight: '600' },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuRowText: { fontSize: 15 },
  emptySection: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySectionText: { marginTop: 8, fontSize: 14 },
});
