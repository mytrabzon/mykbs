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
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';
import { Chip } from '../components/ui';
import EmptyState from '../components/EmptyState';
import AppHeader from '../components/AppHeader';
import { typography, spacing } from '../theme';

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
  const { colors } = useTheme();
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
      <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
        <AppHeader title="Topluluk" tesis={tesis} />
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="people-outline"
            title="Topluluk özelliği"
            message="Topluluk ve bildirimler için kurumsal giriş (Supabase) gereklidir. Giriş sonrası bu alan aktif olur."
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader title="Topluluk" tesis={tesis} />
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'announcement' && { backgroundColor: colors.primary }]}
          onPress={() => setTab('announcement')}
        >
          <Text style={[styles.tabText, { color: tab === 'announcement' ? colors.textInverse : colors.textSecondary }, tab === 'announcement' && styles.tabTextActive]}>Duyurular</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'post' && { backgroundColor: colors.primary }]}
          onPress={() => setTab('post')}
        >
          <Text style={[styles.tabText, { color: tab === 'post' ? colors.textInverse : colors.textSecondary }, tab === 'post' && styles.tabTextActive]}>Paylaşımlar</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={category === item.key}
              onPress={() => setCategory(item.key)}
            />
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>
      {loading && !refreshing ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Henüz paylaşım yok"
              message="İlk duyuruyu veya paylaşımı siz ekleyin."
              primaryCta={{ label: 'İlk Duyuruyu Paylaş', onPress: () => Toast.show({ type: 'info', text1: 'Yakında', text2: 'Paylaşım ekranı yakında' }) }}
              secondaryCta={{ label: 'Kategori Seç', onPress: () => {} }}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('PostDetay', { postId: item.id, post: item })}
              activeOpacity={0.7}
            >
              {item.is_pinned && (
                <View style={[styles.pinnedBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="pin" size={12} color="#fff" />
                </View>
              )}
              {item.title ? <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text> : null}
              <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={3}>{item.body}</Text>
              <View style={styles.cardMeta}>
                <Text style={[styles.cardCategory, { color: colors.primary }]}>{CATEGORIES.find(c => c.key === item.category)?.label || item.category}</Text>
                <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text>
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
  emptyWrap: { flex: 1 },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.screenPadding, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, marginRight: 8, borderRadius: spacing.borderRadius.input },
  tabText: { fontSize: typography.text.body.fontSize },
  tabTextActive: { fontWeight: '600' },
  filterRow: { marginBottom: 12, maxHeight: 44 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: 12,
    padding: spacing.cardPadding,
    borderRadius: spacing.borderRadius.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  pinnedBadge: { position: 'absolute', top: 12, right: 12, borderRadius: 10, padding: 4 },
  cardTitle: { fontSize: typography.text.bodyLarge.fontSize, fontWeight: '600', marginBottom: 6 },
  cardBody: { fontSize: typography.text.body.fontSize, lineHeight: 22, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  cardCategory: { fontSize: typography.text.caption.fontSize },
  cardDate: { fontSize: typography.text.caption.fontSize },
});
