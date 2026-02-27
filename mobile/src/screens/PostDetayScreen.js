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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';

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
      if (meRes && meRes.user_id) setCurrentUserId(meRes.user_id);
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
          communityApi.getMe(t).then((me) => me && me.user_id && setCurrentUserId(me.user_id));
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4361EE" />
      </View>
    );
  }
  if (!post) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Paylaşım bulunamadı.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {post.title ? <Text style={[styles.title, { color: colors.textPrimary }]}>{post.title}</Text> : null}
          <Text style={[styles.body, { color: colors.textSecondary }]}>{post.body}</Text>
          {post.media?.images && post.media.images.length > 0 && (
            <View style={styles.mediaRow}>
              {post.media.images.map((uri, i) => (
                <Image key={i} source={{ uri }} style={styles.mediaImage} resizeMode="cover" />
              ))}
            </View>
          )}
          <View style={styles.meta}>
            <TouchableOpacity onPress={toggleLike} style={styles.likeBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#e74c3c' : colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{liked ? 'Beğenildi' : 'Beğen'}</Text>
            </TouchableOpacity>
            <View style={styles.metaRight}>
              {(post.author_id === currentUserId) && (
                <TouchableOpacity onPress={handleDeletePost} style={styles.deleteBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[styles.deleteBtnText, { color: colors.error }]}>Sil</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(post.created_at).toLocaleString('tr-TR')}</Text>
            </View>
          </View>
        </View>
        <View style={styles.commentsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Yorumlar</Text>
          {comments.length === 0 && <Text style={[styles.noComments, { color: colors.textSecondary }]}>Henüz yorum yok.</Text>}
          {comments.map((c) => (
            <View key={c.id} style={[styles.commentCard, { backgroundColor: colors.surface }]}>
              <View style={styles.commentHeader}>
                <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>
                  {c.author?.display_name || 'Kullanıcı'}
                </Text>
                {c.author_id === currentUserId && (
                  <TouchableOpacity onPress={() => handleDeleteComment(c)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.commentBody, { color: colors.textSecondary }]}>{c.body}</Text>
              <Text style={[styles.commentDate, { color: colors.textSecondary }]}>
                {new Date(c.created_at).toLocaleString('tr-TR')}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Yorum yaz..."
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
          onPress={submitComment}
          disabled={sending || !commentText.trim()}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#666', marginBottom: 12 },
  backBtn: { padding: 12, backgroundColor: '#4361EE', borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  body: { fontSize: 15, color: '#444', lineHeight: 22, marginBottom: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: '#666' },
  date: { fontSize: 12, color: '#999' },
  commentsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 12 },
  noComments: { fontSize: 14, color: '#999' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4361EE', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.6 },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  mediaImage: { width: 100, height: 100, borderRadius: 8 },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtnText: { fontSize: 13 },
  commentCard: { padding: 12, borderRadius: 12, marginBottom: 8 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentAuthor: { fontSize: 14, fontWeight: '600' },
  commentBody: { fontSize: 14, marginBottom: 4 },
  commentDate: { fontSize: 11 },
});
