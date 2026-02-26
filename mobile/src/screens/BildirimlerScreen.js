import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';

export default function BildirimlerScreen({ navigation }) {
  const { getSupabaseToken } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState(null);

  const loadToken = useCallback(async () => {
    const t = await getSupabaseToken();
    setToken(t);
  }, [getSupabaseToken]);

  const loadNotifications = useCallback(async (isRefresh = false) => {
    const t = await getSupabaseToken();
    if (!t) {
      setList([]);
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await communityApi.getInAppNotifications({ limit: 100 }, t);
      setList(res.notifications || []);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Bildirimler yüklenemedi', text2: err.message });
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getSupabaseToken]);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  useEffect(() => {
    if (token) loadNotifications();
    else setLoading(false);
  }, [token]);

  const onRefresh = () => loadNotifications(true);

  const markRead = async (item) => {
    if (item.is_read) return;
    const t = await getSupabaseToken();
    if (!t) return;
    try {
      await communityApi.markNotificationRead(item.id, t);
      setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    } catch (_) {}
  };

  const openNotification = (item) => {
    markRead(item);
    if (item.data?.post_id) {
      navigation.navigate('PostDetay', { postId: item.data.post_id });
    }
  };

  if (!token) {
    return (
      <View style={styles.screenContainer}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Bildirimler</Text>
          <Text style={styles.screenSubtitle}>KBS ve topluluk bildirimleri</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={64} color="#999" />
          <Text style={styles.emptyStateTitle}>Bildirimler</Text>
          <Text style={styles.emptyStateText}>
            Push ve uygulama içi bildirimler için kurumsal giriş gereklidir.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Bildirimler</Text>
        <Text style={styles.screenSubtitle}>KBS ve topluluk bildirimleri</Text>
      </View>
      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#4361EE" /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Henüz bildirim yok.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.is_read && styles.cardUnread]}
              onPress={() => openNotification(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardIcon}>
                <Ionicons
                  name={item.type === 'kbs_status' ? 'document-text' : item.type === 'announcement' ? 'megaphone' : 'chatbubble'}
                  size={22}
                  color="#4361EE"
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  screenHeader: {
    backgroundColor: '#fff',
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  screenSubtitle: { fontSize: 14, color: '#666' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  cardUnread: { backgroundColor: '#F0F4FF' },
  cardIcon: { marginRight: 12 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#666', marginBottom: 4 },
  cardDate: { fontSize: 11, color: '#999' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#666', textAlign: 'center' },
});
