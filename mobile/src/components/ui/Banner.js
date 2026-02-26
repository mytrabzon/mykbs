import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

const TYPES = {
  info: (c) => ({ bg: c.primarySoft, border: c.primary, icon: 'information-circle-outline', iconColor: c.primary }),
  warning: (c) => ({ bg: c.warningSoft, border: c.warning, icon: 'warning-outline', iconColor: c.warning }),
  error: (c) => ({ bg: c.errorSoft, border: c.error, icon: 'alert-circle-outline', iconColor: c.error }),
  success: (c) => ({ bg: c.successSoft, border: c.success, icon: 'checkmark-circle-outline', iconColor: c.success }),
};

export function Banner({ type = 'info', title, message, style }) {
  const { colors } = useTheme();
  const config = TYPES[type]?.(colors) || TYPES.info(colors);

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: config.bg,
          borderLeftWidth: 4,
          borderLeftColor: config.border,
        },
        style,
      ]}
    >
      <Ionicons name={config.icon} size={22} color={config.iconColor} style={styles.icon} />
      <View style={styles.content}>
        {title ? (
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        ) : null}
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: spacing.borderRadius.input,
    marginBottom: spacing.md,
  },
  icon: { marginRight: spacing.sm },
  content: { flex: 1 },
  title: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 2,
  },
  message: {
    fontSize: typography.text.body.fontSize,
    lineHeight: 22,
  },
});
