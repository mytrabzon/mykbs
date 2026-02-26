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
  RefreshControl
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getBackendUrl } from '../services/apiSupabase';
import { logger } from '../utils/logger';

export default function AdminPanelScreen() {
  const navigation = useNavigation();
  const { getSupabaseToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    const base = getBackendUrl();
    if (!base) {
      setError('Backend adresi tanımlı değil. EXPO_PUBLIC_BACKEND_URL ayarlayın.');
      setLoading(false);
      return;
    }
    try {
      const token = await getSupabaseToken();
      if (!token) {
        setError('Oturum bulunamadı. Tekrar giriş yapın.');
        setLoading(false);
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
          setError('Admin paneli için sunucuda Supabase yapılandırması gerekiyor (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY). Bu hesap sadece yetkili yönetici içindir.');
        } else {
          setError(msg);
        }
        setData(null);
        setLoading(false);
        return;
      }
      setData(json);
    } catch (e) {
      logger.error('Admin dashboard fetch', e);
      setError(e?.message || 'Bağlantı hatası. İnterneti kontrol edin.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getSupabaseToken]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Admin Paneli</Text>
        </View>
        <TouchableOpacity style={styles.reloadButton} onPress={() => { setLoading(true); fetchDashboard(); }}>
          <Ionicons name="refresh" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading && !data && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      )}

      {error && !data && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Hata</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchDashboard(); }}>
            <Ionicons name="refresh" size={20} color={theme.colors.white} />
            <Text style={styles.retryButtonText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {data && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchDashboard} colors={[theme.colors.primary]} />
          }
        >
          <View style={styles.cards}>
            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: '#4361EE20' }]}>
                <Ionicons name="business" size={24} color="#4361EE" />
              </View>
              <Text style={styles.cardValue}>{data.toplamTesis ?? 0}</Text>
              <Text style={styles.cardLabel}>Toplam Tesis</Text>
            </View>
            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: '#4CAF5020' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              </View>
              <Text style={styles.cardValue}>{data.aktifTesis ?? 0}</Text>
              <Text style={styles.cardLabel}>Aktif Tesis</Text>
            </View>
          </View>
          <View style={styles.cards}>
            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: '#FF980020' }]}>
                <Ionicons name="notifications" size={24} color="#FF9800" />
              </View>
              <Text style={styles.cardValue}>{data.gunlukBildirim ?? 0}</Text>
              <Text style={styles.cardLabel}>Günlük Bildirim</Text>
            </View>
            <View style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: '#F4433620' }]}>
                <Ionicons name="warning" size={24} color="#F44336" />
              </View>
              <Text style={styles.cardValue}>{data.gunlukHata ?? 0}</Text>
              <Text style={styles.cardLabel}>Günlük Hata</Text>
            </View>
          </View>
          {data.paketDagilimi && Object.keys(data.paketDagilimi).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Paket dağılımı</Text>
              {Object.entries(data.paketDagilimi).map(([paket, count]) => (
                <View key={paket} style={styles.row}>
                  <Text style={styles.rowLabel}>{paket}</Text>
                  <Text style={styles.rowValue}>{count}</Text>
                </View>
              ))}
            </View>
          )}
          {data.kotaAsimi && data.kotaAsimi.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Kota aşımı</Text>
              {data.kotaAsimi.map((t) => (
                <View key={t.id} style={styles.row}>
                  <Text style={styles.rowLabel} numberOfLines={1}>{t.tesisAdi}</Text>
                  <Text style={styles.rowValue}>{t.kullanilanKota}/{t.kota}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  reloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.base,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.borderRadius.base,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  retryButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.base, paddingBottom: theme.spacing.xl * 2 },
  cards: {
    flexDirection: 'row',
    gap: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.base,
    alignItems: 'center',
    ...theme.spacing.shadow?.sm,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.base,
    marginTop: theme.spacing.base,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  rowLabel: { flex: 1, fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary },
  rowValue: { fontSize: theme.typography.fontSize.base, fontWeight: '600', color: theme.colors.textSecondary },
});
