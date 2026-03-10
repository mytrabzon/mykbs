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
import { useTheme } from '../context/ThemeContext';
import AppHeader from '../components/AppHeader';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';

export default function BildirimlerScreen({ navigation }) {
  const { tesis, user, isLoggedIn, getSupabaseToken } = useAuth();
  const { colors } = useTheme();
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
      setRefreshing(false);
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

  // Giriş yapılmış ama bu hesap türünde bildirim yoksa boş liste göster, engel koyma
  const showEmptyBecauseNoSupabase = !!user && !token && !loading;
  if (showEmptyBecauseNoSupabase) {
    return (
      <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
        <AppHeader
          title="Bildirimler"
          tesis={tesis}
          onNotification={() => navigation.navigate('Bildirimler')}
          onProfile={() => navigation.navigate('DahaFazla', { screen: 'Ayarlar' })}
        />
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="notifications-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>Bildirimler</Text>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            Uygulama içi bildirimler e-posta veya telefon ile giriş yaptığınızda burada listelenir.
          </Text>
        </View>
      </View>
    );
  }
  if (!isLoggedIn) {
    return (
      <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
        <AppHeader
          title="Bildirimler"
          tesis={tesis}
          onNotification={() => navigation.navigate('Bildirimler')}
          onProfile={() => navigation.navigate('DahaFazla', { screen: 'Ayarlar' })}
        />
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            Bildirimleri görmek için giriş yapın.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Bildirimler"
        tesis={tesis}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('DahaFazla', { screen: 'Ayarlar' })}
      />
      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="notifications-outline" size={48} color={colors.primary} />
              </View>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Henüz bildirim yok.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }, !item.is_read && { backgroundColor: colors.primarySoft + '40' }]}
              onPress={() => openNotification(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
                <Ionicons
                  name={item.type === 'kbs_status' ? 'document-text' : item.type === 'announcement' ? 'megaphone' : 'chatbubble'}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={2}>{item.body}</Text>
                <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{new Date(item.created_at).toLocaleString('tr-TR')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 120 },
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  cardDate: { fontSize: 12 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyStateText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
