import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing } from '../theme';
import { Button } from './ui/Button';

/**
 * Boş ekran şablonu: büyük ikon (soft), başlık, açıklama, 1–2 aksiyon.
 * primaryCta = { label, onPress }, secondaryCta = { label, onPress } (opsiyonel).
 */
export default function EmptyState({
  icon = 'folder-open-outline',
  iconColor,
  title = 'Veri Bulunamadı',
  message = 'Henüz hiç veri eklenmemiş.',
  primaryCta,
  secondaryCta,
  iconSize = 72,
}) {
  const { colors } = useTheme();
  const softColor = iconColor || colors.textSecondary;
  const iconBg = colors.primarySoft;

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={iconSize} color={softColor} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      <View style={styles.actions}>
        {primaryCta?.label && primaryCta?.onPress && (
          <Button variant="primary" onPress={primaryCta.onPress} style={styles.primaryBtn}>
            {primaryCta.label}
          </Button>
        )}
        {secondaryCta?.label && secondaryCta?.onPress && (
          <Button variant="secondary" onPress={secondaryCta.onPress} style={styles.secondaryBtn}>
            {secondaryCta.label}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.text.h2Large.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.text.body.fontSize,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  primaryBtn: { minWidth: 200 },
  secondaryBtn: { minWidth: 200 },
});
