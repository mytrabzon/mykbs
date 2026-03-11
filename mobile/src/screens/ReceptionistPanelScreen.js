/**
 * Resepsiyon paneli: Bekleyen / başarısız KBS senkronizasyonu, manuel sync, tekrar dene.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as offlineKbs from '../services/offlineKbsDB';
import { sync } from '../services/kbsSyncWorker';
import Toast from 'react-native-toast-message';
import { theme } from '../theme';

export default function ReceptionistPanelScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [pendingList, setPendingList] = useState([]);
  const [failedList, setFailedList] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const stats = await offlineKbs.getQueueStats();
      setPending(stats.pending);
      setFailed(stats.failed);
      const [pendingItems, failedItems] = await Promise.all([
        offlineKbs.getPendingQueue(50),
        offlineKbs.getFailedQueue()
      ]);
      setPendingList(pendingItems);
      setFailedList(failedItems);
    } catch (e) {
      setPending(0);
      setFailed(0);
      setPendingList([]);
      setFailedList([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleManualSync = useCallback(async () => {
    if (syncing || pending === 0) return;
    setSyncing(true);
    try {
      await sync();
      await loadStats();
      Toast.show({ type: 'success', text1: 'Senkronizasyon tamamlandı' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Senkronizasyon hatası', text2: e?.message });
    } finally {
      setSyncing(false);
    }
  }, [syncing, pending, loadStats]);

  const handleRetryFailed = useCallback(async () => {
    if (failedList.length === 0) return;
    setSyncing(true);
    try {
      for (const item of failedList) {
        await offlineKbs.resetToPending(item.id);
      }
      await sync();
      await loadStats();
      Toast.show({ type: 'success', text1: 'Başarısız kayıtlar tekrar kuyruğa alındı' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.message });
    } finally {
      setSyncing(false);
    }
  }, [failedList, loadStats]);

  const retryOne = useCallback(async (id) => {
    try {
      await offlineKbs.resetToPending(id);
      await sync();
      await loadStats();
      Toast.show({ type: 'success', text1: 'Tekrar denendi' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message });
    }
  }, [loadStats]);

  const cancelOne = useCallback(async (id) => {
    try {
      await offlineKbs.deleteFromQueue(id);
      await loadStats();
      Toast.show({ type: 'success', text1: 'Kuyruktan kaldırıldı' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e?.message });
    }
  }, [loadStats]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <TouchableOpacity
        style={styles.statusCard}
        onPress={() => { if (pending > 0 && !syncing) handleManualSync(); }}
        activeOpacity={pending > 0 ? 0.7 : 1}
        disabled={pending === 0 || syncing}
      >
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Bekleyen senkronizasyon</Text>
            <Text style={[styles.statusValue, pending > 0 && styles.statusWarning]}>{pending}</Text>
            {pending > 0 && !syncing && <Text style={styles.statusHint}>Dokun: senkronize et</Text>}
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Başarısız</Text>
            <Text style={[styles.statusValue, failed > 0 && styles.statusError]}>{failed}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.button, styles.syncButton, (syncing || pending === 0) && styles.buttonDisabled]}
          onPress={handleManualSync}
          disabled={syncing || pending === 0}
        >
          {syncing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync" size={20} color="#fff" />}
          <Text style={styles.buttonText}>{syncing ? 'Senkronize ediliyor...' : 'Senkronize et'}</Text>
          {pending > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pending}</Text></View>}
        </TouchableOpacity>

        {failed > 0 && (
          <TouchableOpacity style={[styles.button, styles.retryButton]} onPress={handleRetryFailed} disabled={syncing}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.buttonText}>Başarısızları tekrar dene</Text>
          </TouchableOpacity>
        )}
      </View>

      {pendingList.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Bildirilmek için sırada olanlar</Text>
          {pendingList.slice(0, 30).map((item) => (
            <View key={item.id} style={styles.pendingItem}>
              <View style={styles.failedContent}>
                <Text style={styles.failedName}>
                  {item.misafir_data?.ad} {item.misafir_data?.soyad}
                </Text>
                <Text style={styles.failedMeta}>Oda {item.oda_no} · {new Date(item.created_at).toLocaleTimeString('tr-TR')}</Text>
              </View>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelOne(item.id)}>
                <Ionicons name="close-circle-outline" size={22} color={theme.colors?.textSecondary || '#6B7280'} />
                <Text style={styles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionTitle}>Açıklama</Text>
      <Text style={styles.helpText}>
        Her check-in önce cihazda saklanır. İnternet varken otomatik gönderilir; yoksa bekler. Bu ekrandan manuel senkronize edebilir veya hata alan kayıtları tekrar deneyebilirsiniz.
      </Text>

      {failedList.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Başarısız kayıtlar</Text>
          {failedList.slice(0, 20).map((item) => (
            <View key={item.id} style={styles.failedItem}>
              <View style={styles.failedContent}>
                <Text style={styles.failedName}>
                  {item.misafir_data?.ad} {item.misafir_data?.soyad}
                </Text>
                <Text style={styles.failedMeta}>Oda {item.oda_no} · {new Date(item.created_at).toLocaleTimeString('tr-TR')}</Text>
                {item.last_error ? <Text style={styles.failedError} numberOfLines={2}>{item.last_error}</Text> : null}
              </View>
              <View style={styles.failedActions}>
                <TouchableOpacity style={styles.retrySmall} onPress={() => retryOne(item.id)}>
                  <Ionicons name="refresh" size={22} color={theme.colors?.primary || '#007AFF'} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelOne(item.id)}>
                  <Ionicons name="close-circle-outline" size={22} color={theme.colors?.textSecondary || '#6B7280'} />
                  <Text style={styles.cancelBtnText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  statusRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statusItem: { alignItems: 'center' },
  statusLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  statusValue: { fontSize: 24, fontWeight: '700', color: '#111' },
  statusHint: { fontSize: 10, color: '#059669', marginTop: 2 },
  statusWarning: { color: '#F59E0B' },
  statusError: { color: '#EF4444' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8
  },
  syncButton: { backgroundColor: '#059669' },
  retryButton: { backgroundColor: '#DC2626' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  badge: { backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#059669', fontWeight: '700', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 8 },
  helpText: { fontSize: 13, color: '#6B7280', lineHeight: 20, marginBottom: 24 },
  failedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444'
  },
  failedContent: { flex: 1 },
  failedName: { fontWeight: '600', color: '#111', fontSize: 14 },
  failedMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  failedError: { fontSize: 11, color: '#EF4444', marginTop: 4 },
  failedActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retrySmall: { padding: 8 },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#059669'
  },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 8 },
  cancelBtnText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});
