import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
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
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);

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
        <AppHeader
          title="Topluluk"
          tesis={tesis}
          onNotification={() => navigation.navigate('Bildirimler')}
          onProfile={() => navigation.navigate('Ayarlar')}
        />
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

  const openCategoryModal = () => setCategoryModalVisible(true);
  const closeCategoryModal = () => setCategoryModalVisible(false);

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Topluluk"
        tesis={tesis}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('Ayarlar')}
      />
      <View style={styles.tabsRow}>
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
      <TouchableOpacity
        style={[styles.addTabBtn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('PaylasimEkle')}
      >
        <Ionicons name="add" size={22} color="#fff" />
        <Text style={styles.addTabBtnText}>Paylaşım Ekle</Text>
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
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="Henüz paylaşım yok"
              message="İlk duyuruyu veya paylaşımı siz ekleyin."
              primaryCta={{ label: 'Paylaşım Ekle', onPress: () => navigation.navigate('PaylasimEkle') }}
              secondaryCta={{ label: 'Kategori Seç', onPress: openCategoryModal }}
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
              {item.media?.images?.[0] ? (
                <Image source={{ uri: item.media.images[0] }} style={styles.cardThumb} resizeMode="cover" />
              ) : null}
              <View style={styles.cardMeta}>
                <Text style={[styles.cardCategory, { color: colors.primary }]}>{CATEGORIES.find(c => c.key === item.category)?.label || item.category}</Text>
                <Text style={[styles.cardDate, { color: colors.textSecondary }]}>{new Date(item.created_at).toLocaleDateString('tr-TR')}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={closeCategoryModal}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Kategori Seç</Text>
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.modalItem, category === item.key && { backgroundColor: colors.primarySoft }]}
                onPress={() => {
                  setCategory(item.key);
                  closeCategoryModal();
                }}
              >
                <Text style={[styles.modalItemText, { color: category === item.key ? colors.primary : colors.textPrimary }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.modalClose, { borderColor: colors.border }]} onPress={closeCategoryModal}>
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  emptyWrap: { flex: 1 },
  tabsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.screenPadding, paddingTop: 12, marginBottom: 16 },
  tabs: { flexDirection: 'row', marginRight: 12 },
  tab: { paddingVertical: 10, paddingHorizontal: 20, marginRight: 10, borderRadius: 16 },
  addTabBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, gap: 6 },
  addTabBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabText: { fontSize: typography.text.body.fontSize },
  tabTextActive: { fontWeight: '600' },
  filterRow: { marginBottom: 12, maxHeight: 44 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: 14,
    padding: spacing.cardPadding,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  pinnedBadge: { position: 'absolute', top: 12, right: 12, borderRadius: 10, padding: 4 },
  cardTitle: { fontSize: typography.text.bodyLarge.fontSize, fontWeight: '600', marginBottom: 6 },
  cardBody: { fontSize: typography.text.body.fontSize, lineHeight: 22, marginBottom: 8 },
  cardThumb: { width: '100%', height: 120, borderRadius: 10, marginBottom: 8 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  cardCategory: { fontSize: typography.text.caption.fontSize },
  cardDate: { fontSize: typography.text.caption.fontSize },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screenPadding,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: spacing.borderRadius.card,
    padding: spacing.cardPadding,
  },
  modalTitle: {
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: '600',
    marginBottom: spacing.base,
  },
  modalItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderRadius: spacing.borderRadius.input,
    marginBottom: 4,
  },
  modalItemText: { fontSize: typography.text.body.fontSize },
  modalClose: {
    marginTop: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  modalCloseText: { fontSize: typography.text.body.fontSize },
});
