import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import * as communityApi from '../services/communityApi';
import Toast from 'react-native-toast-message';

export default function PostDetayScreen({ route, navigation }) {
  const { postId, post: postParam } = route.params || {};
  const { getSupabaseToken } = useAuth();
  const [post, setPost] = useState(postParam || null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(!postParam && !!postId);
  const [sending, setSending] = useState(false);
  const [liked, setLiked] = useState(false);

  const load = async () => {
    const t = await getSupabaseToken();
    if (!t || !postId) return;
    setLoading(true);
    try {
      const res = await communityApi.getCommunityPosts({ limit: 50 }, t);
      const found = (res.posts || []).find((p) => p.id === postId);
      setPost(found || null);
      setComments([]);
    } catch (_) {
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (postParam) {
      setPost(postParam);
      setLoading(false);
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
      load();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: err.message });
    } finally {
      setSending(false);
    }
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
        <View style={styles.card}>
          {post.title ? <Text style={styles.title}>{post.title}</Text> : null}
          <Text style={styles.body}>{post.body}</Text>
          <View style={styles.meta}>
            <TouchableOpacity onPress={toggleLike} style={styles.likeBtn}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#e74c3c' : '#666'} />
              <Text style={styles.metaText}>{liked ? 'Beğenildi' : 'Beğen'}</Text>
            </TouchableOpacity>
            <Text style={styles.date}>{new Date(post.created_at).toLocaleString('tr-TR')}</Text>
          </View>
        </View>
        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Yorumlar</Text>
          {comments.length === 0 && <Text style={styles.noComments}>Henüz yorum yok.</Text>}
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
});
