import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AppHeader from '../components/AppHeader';
import { typography, spacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import * as communityApi from '../services/communityApi';
import { api } from '../services/api';

export default function ToplulukProfilScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { tesis, user, getSupabaseToken } = useAuth();
  const { userId, profile: initialProfile } = route.params || {};

  const [profile, setProfile] = useState(initialProfile || null);
  const [meId, setMeId] = useState(null);
  const hasInitialData = !!(userId && initialProfile && typeof initialProfile === 'object');
  const [loading, setLoading] = useState(!hasInitialData);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getSupabaseToken();
        if (token) {
          const me = await communityApi.getMe(token);
          if (!cancelled) {
            setMeId(me?.user_id || null);
            if (!userId || userId === me?.user_id) {
              setProfile({
                display_name: me?.display_name || null,
                avatar_url: me?.avatar_url || null,
                title: me?.title || null,
              });
            }
          }
        } else if (user && !userId) {
          // Tesis kodu / PIN ile giriş: kendi profilini backend'den al
          try {
            const res = await api.get('/auth/profile');
            const data = res?.data || {};
            if (!cancelled) {
              setMeId(user?.id || null);
              setProfile({
                display_name: data.display_name ?? user?.adSoyad ?? user?.displayName ?? null,
                avatar_url: data.avatar_url ?? null,
                title: data.title ?? null,
              });
            }
          } catch {
            if (!cancelled) {
              setMeId(user?.id || null);
              setProfile({
                display_name: user?.adSoyad ?? user?.displayName ?? null,
                avatar_url: null,
                title: null,
              });
            }
          }
        }
      } catch {
        // Sessiz geç
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getSupabaseToken, userId, user]);

  const displayName = profile?.display_name || 'Kullanıcı';
  const avatarUrl = profile?.avatar_url || null;
  const title = profile?.title || null;
  const isMe = meId && (!userId || userId === meId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Profil"
        tesis={tesis}
        onBack={() => navigation.goBack()}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('ProfilDuzenle')}
      />
      {loading ? (
        <View style={[styles.centered, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.avatarSection}>
              <View style={[styles.avatarWrap, { backgroundColor: colors.border }]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <Ionicons name="person" size={48} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.nameBlock}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {displayName}
                </Text>
                {title ? (
                  <Text style={[styles.title, { color: colors.textSecondary }]} numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
              </View>
            </View>
            {isMe && (
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: colors.primary }]}
                onPress={() => navigation.navigate('ProfilDuzenle')}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <Text style={[styles.editBtnText, { color: colors.primary }]}>Profili düzenle</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.screenPadding, paddingBottom: spacing.lg },
  card: { borderRadius: 16, padding: spacing.cardPadding },
  avatarSection: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  nameBlock: { marginLeft: 16, flex: 1 },
  name: { fontSize: typography.text.h2.fontSize, fontWeight: '700' },
  title: { marginTop: 4, fontSize: typography.text.body.fontSize },
  editBtn: {
    marginTop: spacing.lg,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: '600',
  },
});

