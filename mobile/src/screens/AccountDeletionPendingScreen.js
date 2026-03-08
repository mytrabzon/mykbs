import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function AccountDeletionPendingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, deletionAt, restoreAccount, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deletionDateStr = deletionAt
    ? new Date(deletionAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const handleRestore = async () => {
    setLoading(true);
    setError(null);
    try {
      await restoreAccount();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Hesap geri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.iconWrap}>
        <Ionicons name="warning-outline" size={64} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Hesap silme talebi aktif</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        Hesabınız silinmek üzere planlandı. {deletionDateStr} tarihinde hesabınız ve tüm verileriniz (belgeler, işlemler, KBS kayıtları) kalıcı olarak silinecektir.
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary, marginTop: 8 }]}>
        Hesabınızı kullanmaya devam etmek isterseniz aşağıdaki butona tıklayarak talebi iptal edebilirsiniz.
      </Text>
      {error ? (
        <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
      ) : null}
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        onPress={handleRestore}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Ionicons name="refresh-outline" size={22} color="#FFF" />
            <Text style={styles.primaryBtnText}>Hesabı geri al</Text>
          </>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
        onPress={logout}
        disabled={loading}
      >
        <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Çıkış yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  error: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
    minWidth: 200,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  secondaryBtnText: {
    fontSize: 15,
  },
});
