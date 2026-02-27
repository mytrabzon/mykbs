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
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POST_IMAGE_SIZE = SCREEN_WIDTH;
const AVATAR_SIZE = 36;

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

function PostCard({ item, colors, onPress, onCommentPress, categoryLabel }) {
  const imageUri = item.media?.images?.[0];
  const authorName = item.author?.display_name || 'Kullanıcı';
  const authorAvatar = item.author?.avatar_url || null;

  return (
    <View style={[styles.postCard, { backgroundColor: colors.surface }]}>
      {/* Üst: avatar + isim + pin */}
      <TouchableOpacity
        style={styles.postHeader}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.avatarWrap, { backgroundColor: colors.border }]}>
          {authorAvatar ? (
            <Image source={{ uri: authorAvatar }} style={styles.avatar} />
          ) : (
            <Ionicons name="person" size={20} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.postHeaderText}>
          <Text style={[styles.postAuthor, { color: colors.textPrimary }]} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={[styles.postMeta, { color: colors.textSecondary }]}>
            {categoryLabel} · {new Date(item.created_at).toLocaleDateString('tr-TR')}
          </Text>
        </View>
        {item.is_pinned && (
          <View style={styles.pinIcon}>
            <Ionicons name="pin" size={16} color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>

      {/* Görsel - tam genişlik, Instagram oranı */}
      {imageUri ? (
        <TouchableOpacity onPress={onPress} activeOpacity={1}>
          <Image
            source={{ uri: imageUri }}
            style={styles.postImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ) : null}

      {/* Alt: aksiyonlar + caption */}
      <View style={styles.postFooter}>
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
            <Ionicons name="heart-outline" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onCommentPress}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        {(item.body || item.title) ? (
          <Text style={[styles.postCaption, { color: colors.textPrimary }]} numberOfLines={3}>
            {item.title ? <Text style={styles.captionBold}>{item.title} </Text> : null}
            {item.body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function ToplulukScreen({ navigation }) {
  const { tesis, getSupabaseToken } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState('announcement');
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
          onProfile={() => navigation.navigate('ProfilDuzenle')}
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
        onProfile={() => navigation.navigate('ProfilDuzenle')}
        rightComponent={
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.headerAddBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('PaylasimEkle')}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Bildirimler')} style={styles.headerIconBtn}>
              <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('ProfilDuzenle')} style={styles.headerIconBtn}>
              <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Tab bar - Instagram style */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'announcement' && styles.tabItemActive]}
          onPress={() => setTab('announcement')}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: tab === 'announcement' ? colors.primary : colors.textSecondary },
              tab === 'announcement' && styles.tabLabelActive,
            ]}
          >
            Duyurular
          </Text>
          {tab === 'announcement' && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'post' && styles.tabItemActive]}
          onPress={() => setTab('post')}
        >
          <Text
            style={[
              styles.tabLabel,
              { color: tab === 'post' ? colors.primary : colors.textSecondary },
              tab === 'post' && styles.tabLabelActive,
            ]}
          >
            Paylaşımlar
          </Text>
          {tab === 'post' && <View style={[styles.tabIndicator, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      {/* Kategori chips */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          renderItem={({ item }) => (
            <Chip
              label={item.label}
              selected={category === item.key}
              onPress={() => setCategory(item.key)}
            />
          )}
        />
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="images-outline"
              title="Henüz paylaşım yok"
              message="İlk duyuruyu veya paylaşımı siz ekleyin."
              primaryCta={{ label: 'Paylaşım Ekle', onPress: () => navigation.navigate('PaylasimEkle') }}
              secondaryCta={{ label: 'Kategori Seç', onPress: openCategoryModal }}
            />
          }
          renderItem={({ item }) => (
            <PostCard
              item={item}
              colors={colors}
              categoryLabel={CATEGORIES.find((c) => c.key === item.category)?.label || item.category || ''}
              onPress={() => navigation.navigate('PostDetay', { postId: item.id, post: item })}
              onCommentPress={() => navigation.navigate('PostDetay', { postId: item.id, post: item })}
            />
          )}
        />
      )}

      {/* FAB - Paylaşım Ekle */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('PaylasimEkle')}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

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
                <Text
                  style={[styles.modalItemText, { color: category === item.key ? colors.primary : colors.textPrimary }]}
                >
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtn: { padding: 8, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.screenPadding,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: typography.text.body.fontSize,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 2,
    borderRadius: 1,
  },
  filterRow: { marginBottom: 8, maxHeight: 44 },
  chipsContent: { paddingHorizontal: spacing.screenPadding, gap: 8, paddingVertical: 8 },
  listContent: { paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  postCard: {
    marginBottom: 12,
    paddingBottom: 0,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 12,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  postHeaderText: { flex: 1, minWidth: 0 },
  postAuthor: {
    fontSize: typography.text.body.fontSize,
    fontWeight: '600',
  },
  postMeta: {
    fontSize: typography.text.caption.fontSize,
    marginTop: 2,
  },
  pinIcon: { marginLeft: 8 },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#E2E8F0',
  },
  postFooter: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 10,
    paddingBottom: 14,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  actionBtn: { marginRight: 16, padding: 4 },
  postCaption: {
    fontSize: typography.text.body.fontSize,
    lineHeight: 20,
  },
  captionBold: { fontWeight: '600' },

  fab: {
    position: 'absolute',
    right: spacing.screenPadding,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },

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
