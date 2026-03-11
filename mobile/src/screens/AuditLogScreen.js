/**
 * Audit Log — Hamburger menüden; sistem işlem kayıtları listesi.
 * Backend GET /app-admin/audit (Supabase audit_logs).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import AppHeader from '../components/AppHeader';
import Toast from 'react-native-toast-message';

function formatDate(createdAt) {
  if (!createdAt) return '—';
  try {
    return new Date(createdAt).toLocaleString('tr-TR');
  } catch {
    return String(createdAt);
  }
}

function AuditRow({ item, colors }) {
  const metaStr = item.meta_json
    ? (typeof item.meta_json === 'string' ? item.meta_json : JSON.stringify(item.meta_json))
    : '';
  const shortMeta = metaStr.length > 60 ? metaStr.slice(0, 57) + '…' : metaStr;
  const entityLabel = item.entity_id ? `${item.entity} #${String(item.entity_id).slice(0, 8)}` : item.entity;
  const userIdLabel = item.user_id ? `${String(item.user_id).slice(0, 8)}…` : '—';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.rowTop}>
        <Text style={[styles.rowDate, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
        <Text style={[styles.rowAction, { color: colors.primary }]}>{item.action}</Text>
      </View>
      <Text style={[styles.rowEntity, { color: colors.textPrimary }]}>{entityLabel}</Text>
      <Text style={[styles.rowUser, { color: colors.textSecondary }]}>User: {userIdLabel}</Text>
      {shortMeta ? (
        <Text style={[styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={2}>{shortMeta}</Text>
      ) : null}
    </View>
  );
}

export default function AuditLogScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/app-admin/audit?limit=100');
      const data = res?.data ?? {};
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'Audit log yüklenemedi';
      setLogs([]);
      if (status === 401) {
        Toast.show({ type: 'error', text1: 'Oturum gerekli', text2: 'Tekrar giriş yapın.' });
      } else {
        Toast.show({ type: 'error', text1: 'Yüklenemedi', text2: msg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => load(true);

  if (loading && logs.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <AppHeader
          title="Audit Log"
          tesis={tesis}
          onNotification={() => navigation.navigate('Bildirimler')}
          onProfile={() => navigation.navigate('DahaFazla', { screen: 'Ayarlar' })}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <AppHeader
        title="Audit Log"
        tesis={tesis}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('DahaFazla', { screen: 'Ayarlar' })}
      />
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Sistem işlem kayıtları. Son 100 kayıt listelenir.
      </Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id || String(Math.random())}
        renderItem={({ item }) => <AuditRow item={item} colors={colors} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Kayıt yok.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  subtitle: {
    fontSize: 13,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContent: { paddingHorizontal: 16 },
  row: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderBottomWidth: 1,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  rowDate: { fontSize: 12 },
  rowAction: { fontSize: 14, fontWeight: '600' },
  rowEntity: { fontSize: 14, marginBottom: 4 },
  rowUser: { fontSize: 12, marginBottom: 2 },
  rowMeta: { fontSize: 11, fontFamily: 'monospace' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 16 },
});
