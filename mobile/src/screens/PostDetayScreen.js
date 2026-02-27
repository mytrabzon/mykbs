import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AVATAR_SIZE = 40;

export default function PostDetayScreen({ route, navigation }) {
  const { postId, post: postParam } = route.params || {};
  const { getSupabaseToken } = useAuth();
  const { colors } = useTheme();
  const [post, setPost] = useState(postParam || null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(!postParam && !!postId);
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const loadComments = useCallback(async () => {
    const t = await getSupabaseToken();
    if (!t || !postId) return;
    try {
      const res = await communityApi.getPostComments(postId, t);
      setComments(res.comments || []);
    } catch (_) {
      setComments([]);
    }
  }, [postId, getSupabaseToken]);

  const load = useCallback(async () => {
    const t = await getSupabaseToken();
    if (!t || !postId) return;
    setLoading(true);
    try {
      const [postsRes, meRes] = await Promise.all([
        communityApi.getCommunityPosts({ limit: 50 }, t),
        communityApi.getMe(t),
      ]);
      const found = (postsRes.posts || []).find((p) => p.id === postId);
      setPost(found || null);
      if (meRes?.user_id) setCurrentUserId(meRes.user_id);
      const commentRes = await communityApi.getPostComments(postId, t);
      setComments(commentRes.comments || []);
    } catch (_) {
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId, getSupabaseToken]);

  useEffect(() => {
    if (postParam) {
      setPost(postParam);
      setLoading(false);
      getSupabaseToken().then((t) => {
        if (t) {
          communityApi.getMe(t).then((me) => me?.user_id && setCurrentUserId(me.user_id));
          loadComments();
        }
      });
      return;
    }
    if (postId) load();
  }, [postId, postParam]);

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    const t = await getSupabaseToken();
    if (!t) return;
    setSending(true);
    try {
      await communityApi.addComment(postId, text, t);
      setCommentText('');
      Toast.show({ type: 'success', text1: 'Yorum eklendi' });
      loadComments();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = (comment) => {
    Alert.alert('Yorumu sil', 'Bu yorumu silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const t = await getSupabaseToken();
          if (!t) return;
          try {
            await communityApi.deleteComment(comment.id, t);
            Toast.show({ type: 'success', text1: 'Yorum silindi' });
            loadComments();
          } catch (err) {
            Toast.show({ type: 'error', text1: 'Silinemedi', text2: err.message });
          }
        },
      },
    ]);
  };

  const handleDeletePost = () => {
    Alert.alert('Paylaşımı sil', 'Bu paylaşımı silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const t = await getSupabaseToken();
          if (!t) return;
          try {
            await communityApi.deletePost(postId, t);
            Toast.show({ type: 'success', text1: 'Paylaşım silindi' });
            navigation.goBack();
          } catch (err) {
            Toast.show({ type: 'error', text1: 'Silinemedi', text2: err.message });
          }
        },
      },
    ]);
  };

  const toggleLike = async () => {
    const t = await getSupabaseToken();
    if (!t) return;
    try {
      await communityApi.toggleReaction(postId, liked, t);
      setLiked(!liked);
    } catch (_) {}
  };

  if (loading && !post) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!post) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Paylaşım bulunamadı.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.backBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const authorName = post.author?.display_name || 'Kullanıcı';
  const authorAvatar = post.author?.avatar_url || null;
  const mainImage = post.media?.images?.[0];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Üst: avatar + isim - Instagram post header */}
        <View style={[styles.postHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.avatarWrap, { backgroundColor: colors.border }]}>
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={styles.avatar} />
            ) : (
              <Ionicons name="person" size={22} color={colors.textSecondary} />
            )}
          </View>
          <View style={styles.postHeaderText}>
            <Text style={[styles.postAuthor, { color: colors.textPrimary }]}>{authorName}</Text>
            <Text style={[styles.postDate, { color: colors.textSecondary }]}>
              {new Date(post.created_at).toLocaleString('tr-TR')}
            </Text>
          </View>
          {post.author_id === currentUserId && (
            <TouchableOpacity onPress={handleDeletePost} style={styles.moreBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* Görsel - tam genişlik */}
        {mainImage && (
          <Image source={{ uri: mainImage }} style={styles.postImage} resizeMode="cover" />
        )}
        {post.media?.images?.length > 1 && (
          <View style={styles.multiImageRow}>
            {post.media.images.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.multiImage} resizeMode="cover" />
            ))}
          </View>
        )}

        {/* Aksiyon satırı: beğen, yorum */}
        <View style={[styles.actionBar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={toggleLike} style={styles.actionBtn}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? '#e74c3c' : colors.textPrimary}
            />
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
              {liked ? 'Beğenildi' : 'Beğen'}
            </Text>
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.textPrimary} />
            <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
              Yorumlar {comments.length ? `(${comments.length})` : ''}
            </Text>
          </View>
        </View>

        {/* Caption */}
        <View style={styles.captionBlock}>
          {(post.title || post.body) && (
            <Text style={[styles.caption, { color: colors.textPrimary }]}>
              {post.title ? <Text style={styles.captionBold}>{post.title} </Text> : null}
              {post.body}
            </Text>
          )}
        </View>

        {/* Yorumlar */}
        <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Yorumlar {comments.length ? `(${comments.length})` : ''}
          </Text>
          {comments.length === 0 && (
            <Text style={[styles.noComments, { color: colors.textSecondary }]}>Henüz yorum yok. İlk yorumu siz yapın.</Text>
          )}
          {comments.map((c) => (
            <View key={c.id} style={styles.commentRow}>
              <View style={[styles.commentAvatar, { backgroundColor: colors.border }]}>
                {c.author?.avatar_url ? (
                  <Image source={{ uri: c.author.avatar_url }} style={styles.commentAvatarImg} />
                ) : (
                  <Ionicons name="person" size={16} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.commentBodyWrap}>
                <View style={styles.commentHeader}>
                  <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>
                    {c.author?.display_name || 'Kullanıcı'}
                  </Text>
                  {c.author_id === currentUserId && (
                    <TouchableOpacity onPress={() => handleDeleteComment(c)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={[styles.commentBody, { color: colors.textSecondary }]}>{c.body}</Text>
                <Text style={[styles.commentDate, { color: colors.textDisabled }]}>
                  {new Date(c.created_at).toLocaleString('tr-TR')}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Yorum input - Instagram tarzı altta sabit */}
      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary }]}
          placeholder="Yorum yaz..."
          placeholderTextColor={colors.textSecondary}
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }, (sending || !commentText.trim()) && styles.sendBtnDisabled]}
          onPress={submitComment}
          disabled={sending || !commentText.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { marginBottom: 12, fontSize: 15 },
  backBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  backBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  postHeaderText: { flex: 1, minWidth: 0 },
  postAuthor: { fontSize: 15, fontWeight: '600' },
  postDate: { fontSize: 12, marginTop: 2 },
  moreBtn: { padding: 8 },

  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: '#E2E8F0',
  },
  multiImageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4 },
  multiImage: { width: (SCREEN_WIDTH - 12) / 3, height: (SCREEN_WIDTH - 12) / 3, borderRadius: 4 },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 24,
    borderBottomWidth: 1,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 13 },

  captionBlock: { padding: 16, paddingBottom: 8 },
  caption: { fontSize: 15, lineHeight: 22 },
  captionBold: { fontWeight: '600' },

  commentsSection: {
    padding: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  noComments: { fontSize: 14, marginBottom: 8 },
  commentRow: { flexDirection: 'row', marginBottom: 16 },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  commentAvatarImg: { width: 32, height: 32 },
  commentBodyWrap: { flex: 1, minWidth: 0 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  commentAuthor: { fontSize: 14, fontWeight: '600' },
  commentBody: { fontSize: 14, lineHeight: 20 },
  commentDate: { fontSize: 11, marginTop: 2 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  bottomPad: { height: 24 },
});
