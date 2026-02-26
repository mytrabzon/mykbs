import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';

const CATEGORIES = [
  { key: '', label: 'Tümü' },
  { key: 'announcement', label: 'Duyurular' },
  { key: 'procedure', label: 'Prosedür' },
  { key: 'warning', label: 'Uyarı' },
  { key: 'experience', label: 'Deneyim' },
  { key: 'question', label: 'Soru' },
  { key: 'solution', label: 'Çözüm' },
  { key: 'general', label: 'Genel' },
];

export default function ToplulukScreen({ navigation }) {
  const { tesis, getSupabaseToken } = useAuth();
  const [tab, setTab] = useState('announcement'); // announcement | post
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('');
  const [token, setToken] = useState(null);
  const [hasCommunity, setHasCommunity] = useState(false);

  const loadToken = useCallback(async () => {
    const t = await getSupabaseToken();
    setToken(t);
    setHasCommunity(!!t);
  }, [getSupabaseToken]);

  const loadPosts = useCallback(async (isRefresh = false) => {
    const t = await getSupabaseToken();
    if (!t) {
      setPosts([]);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      let branchId = tesis?.id;
      if (!branchId) {
        try {
          const me = await communityApi.getMe(t);
          branchId = me?.branch_id;
        } catch (_) {}
      }
      if (!branchId) {
        setPosts([]);
        return;
      }
      const res = await communityApi.getCommunityPosts({
        branch_id: branchId,
        type: tab === 'announcement' ? 'announcement' : 'post',
        category: category || undefined,
        limit: 30,
        offset: 0,
      }, t);
      setPosts(res.posts || []);
    } catch (err) {
      if (err.status === 401 || err.code === 'UNAUTHORIZED') {
        setHasCommunity(false);
      }
      Toast.show({ type: 'error', text1: 'Yüklenemedi', text2: err.message || 'Liste alınamadı' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tesis?.id, tab, category, getSupabaseToken]);

  useEffect(() => {
    loadToken();
  }, [loadToken]);

  useEffect(() => {
    if (token) loadPosts();
    else setPosts([]);
  }, [token, tab, category]);

  const onRefresh = () => loadPosts(true);

  if (!hasCommunity && !token) {
    return (
      <View style={styles.screenContainer}>
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>Topluluk</Text>
          <Text style={styles.screenSubtitle}>Duyurular ve paylaşımlar</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#999" />
          <Text style={styles.emptyStateTitle}>Topluluk özelliği</Text>
          <Text style={styles.emptyStateText}>
            Topluluk ve bildirimler için kurumsal giriş (Supabase) gereklidir. Backend tarafında giriş sonrası supabase_access_token sağlanırsa bu alan aktif olur.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Topluluk</Text>
        <Text style={styles.screenSubtitle}>Duyurular ve paylaşımlar</Text>
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'announcement' && styles.tabActive]}
          onPress={() => setTab('announcement')}
        >
          <Text style={[styles.tabText, tab === 'announcement' && styles.tabTextActive]}>Duyurular</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'post' && styles.tabActive]}
          onPress={() => setTab('post')}
        >
          <Text style={[styles.tabText, tab === 'post' && styles.tabTextActive]}>Paylaşımlar</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, category === item.key && styles.chipActive]}
              onPress={() => setCategory(item.key)}
            >
              <Text style={[styles.chipText, category === item.key && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#4361EE" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Henüz paylaşım yok.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PostDetay', { postId: item.id, post: item })}
              activeOpacity={0.7}
            >
              {item.is_pinned && (
                <View style={styles.pinnedBadge}>
                  <Ionicons name="pin" size={12} color="#fff" />
                </View>
              )}
              {item.title ? <Text style={styles.cardTitle}>{item.title}</Text> : null}
              <Text style={styles.cardBody} numberOfLines={3}>{item.body}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardCategory}>{CATEGORIES.find(c => c.key === item.category)?.label || item.category}</Text>
                <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text>
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
  tabs: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, borderRadius: 8 },
  tabActive: { backgroundColor: '#4361EE' },
  tabText: { fontSize: 14, color: '#666' },
  tabTextActive: { fontSize: 14, fontWeight: '600', color: '#fff' },
  filterRow: { marginBottom: 12, maxHeight: 44 },
  chip: { marginRight: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#4361EE' },
  chipText: { fontSize: 12, color: '#666' },
  chipTextActive: { fontSize: 12, color: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  pinnedBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#4361EE', borderRadius: 10, padding: 4 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  cardCategory: { fontSize: 12, color: '#4361EE' },
  cardDate: { fontSize: 12, color: '#999' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyStateTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#666', textAlign: 'center' },
});
