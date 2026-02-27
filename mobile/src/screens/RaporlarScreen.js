import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import AppHeader from '../components/AppHeader';
import EmptyState from '../components/EmptyState';
import Toast from 'react-native-toast-message';

export default function RaporlarScreen({ navigation }) {
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadRapor = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get('/rapor');
      setData(res?.data ?? null);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || err?.message || 'Rapor alınamadı';
      setError(msg);
      setData(null);
      if (!isRefresh) {
        if (status === 409) Toast.show({ type: 'info', text1: 'Onay Bekleniyor', text2: msg || 'Şube/KBS onayından sonra raporlar açılacaktır.', visibilityTime: 4000 });
        else if (status === 403) Toast.show({ type: 'error', text1: 'Yetki yok', text2: msg });
        else Toast.show({ type: 'error', text1: status === 500 ? 'Sunucu hatası' : 'Rapor yüklenemedi', text2: msg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRapor();
  }, [loadRapor]);

  const cards = data
    ? [
        {
          key: 'doluluk',
          icon: 'calendar',
          iconBg: colors.primarySoft,
          iconColor: colors.primary,
          label: 'Doluluk Oranı',
          value: `${data.dolulukOrani ?? 0}%`,
        },
        {
          key: 'aktif',
          icon: 'person',
          iconBg: colors.successSoft,
          iconColor: colors.success,
          label: 'Aktif Misafir',
          value: String(data.aktifMisafirSayisi ?? 0),
        },
        {
          key: 'yeni',
          icon: 'person-add',
          iconBg: colors.warningSoft,
          iconColor: colors.warning,
          label: 'Bu Ay Yeni Giriş',
          value: String(data.buAyYeniMisafir ?? 0),
        },
        {
          key: 'kalış',
          icon: 'time',
          iconBg: colors.accentSoft || colors.primarySoft,
          iconColor: colors.accent || colors.primary,
          label: 'Ort. Kalış',
          value:
            data.ortalamaKalısGun != null ? `${data.ortalamaKalısGun} gün` : '—',
        },
      ]
    : [];

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Raporlar"
        tesis={tesis}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('ProfilDuzenle')}
      />
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Rapor yükleniyor...
          </Text>
        </View>
      ) : error && !data ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRapor(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <EmptyState
            icon="stats-chart-outline"
            title="Rapor alınamadı"
            message={error}
            primaryCta={{ label: 'Tekrar dene', onPress: () => loadRapor(true) }}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRapor(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.reportsGrid}>
            {cards.map((r) => (
              <View
                key={r.key}
                style={[styles.reportCardModern, { backgroundColor: colors.surface }]}
              >
                <View style={[styles.reportIconModern, { backgroundColor: r.iconBg }]}>
                  <Ionicons name={r.icon} size={24} color={r.iconColor} />
                </View>
                <Text style={[styles.reportValueModern, { color: colors.textPrimary }]}>
                  {r.value}
                </Text>
                <Text style={[styles.reportTitleModern, { color: colors.textSecondary }]}>
                  {r.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.chartContainerModern, { backgroundColor: colors.surface }]}>
            <Text style={[styles.chartTitleModern, { color: colors.textPrimary }]}>
              Özet
            </Text>
            <View style={[styles.chartPlaceholderModern, { backgroundColor: colors.background }]}>
              <Text style={[styles.chartPlaceholderText, { color: colors.textSecondary }]}>
                {data
                  ? `${data.doluOda ?? 0} dolu / ${data.toplamOda ?? 0} oda · Doluluk %${data.dolulukOrani ?? 0}`
                  : 'Veri yok'}
              </Text>
              <Text style={[styles.chartPlaceholderSub, { color: colors.textSecondary }]}>
                Günlük doluluk grafiği ileride eklenecektir.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  emptyContainer: { flex: 1, paddingHorizontal: 20, paddingBottom: 120 },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 20,
    gap: 12,
  },
  reportCardModern: {
    width: '48%',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  reportIconModern: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitleModern: { fontSize: 13, marginTop: 4 },
  reportValueModern: { fontSize: 24, fontWeight: '700' },
  chartContainerModern: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  chartTitleModern: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  chartPlaceholderModern: {
    minHeight: 120,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  chartPlaceholderText: { fontSize: 15, fontWeight: '500' },
  chartPlaceholderSub: { fontSize: 12, marginTop: 8 },
});
