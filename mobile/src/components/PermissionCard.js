/**
 * Modern izin kartı — özelliğe girildiğinde ekranda gösterilir, uygulamadan atmaz.
 * Kullanım: Bildirim, kamera, konum vb. izin istekleri için tek bileşen.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme, spacing } from '../theme';

/**
 * @param {string} icon - Ionicons adı (örn. 'notifications-outline', 'camera-outline')
 * @param {string} title - Kart başlığı
 * @param {string} description - Açıklama metni
 * @param {() => Promise<void>|void} onAllow - "İzin ver" tıklanınca
 * @param {() => void} onDismiss - "Şimdi değil" / "Geri" tıklanınca
 * @param {string} [allowLabel='İzin ver']
 * @param {string} [dismissLabel='Şimdi değil']
 * @param {boolean} [allowLoading=false] - Kabul et tıklanınca yükleme göstergesi
 */
export default function PermissionCard({
  icon = 'lock-open-outline',
  title,
  description,
  onAllow,
  onDismiss,
  allowLabel = 'İzin ver',
  dismissLabel = 'Şimdi değil',
  allowLoading = false,
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: (colors.primary || theme.colors.primary) + '18' }]}>
        <Ionicons name={icon} size={32} color={colors.primary || theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      <TouchableOpacity
        style={[styles.primaryBtn, { backgroundColor: colors.primary || theme.colors.primary }]}
        onPress={onAllow}
        activeOpacity={0.85}
        disabled={allowLoading}
      >
        {allowLoading ? (
          <ActivityIndicator size="small" color="#FFF" />
        ) : (
          <Text style={styles.primaryBtnText}>{allowLabel}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.7}>
        <Text style={[styles.dismissText, { color: colors.textSecondary }]}>{dismissLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xl + 4,
    paddingHorizontal: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    ...(Platform.OS === 'android' ? { elevation: 4 } : {}),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  primaryBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl + 8,
    borderRadius: 14,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  dismissText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
