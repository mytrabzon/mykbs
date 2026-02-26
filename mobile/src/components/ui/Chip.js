import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

export function Chip({ label, selected, onPress, style }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: selected ? colors.primary : colors.textSecondary },
          selected && styles.textSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.borderRadius.pill,
    marginRight: spacing.xs,
  },
  text: {
    fontSize: typography.text.captionLarge.fontSize,
    fontWeight: typography.fontWeight.medium,
  },
  textSelected: {
    fontWeight: typography.fontWeight.semibold,
  },
});
