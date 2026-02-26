import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing } from '../../theme';

export function SegmentedControl({ options, value, onChange, style }) {
  const { colors, isDark } = useTheme();
  const containerBg = isDark ? '#111C33' : '#EEF2FF';

  return (
    <View style={[styles.container, { backgroundColor: containerBg }, style]}>
      {options.map((opt) => {
        const isSelected = (opt.value !== undefined ? opt.value : opt.key) === value;
        return (
          <TouchableOpacity
            key={opt.key || opt.value}
            activeOpacity={0.85}
            onPress={() => onChange(opt.value !== undefined ? opt.value : opt.key)}
            style={[
              styles.option,
              isSelected && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            {opt.icon ? opt.icon(isSelected ? colors.textInverse : colors.textSecondary) : null}
            <Text
              style={[
                styles.label,
                { color: isSelected ? colors.textInverse : colors.textSecondary },
                isSelected && styles.labelSelected,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: spacing.borderRadius.input,
    padding: 4,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.borderRadius.input - 2,
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.medium,
  },
  labelSelected: {
    fontWeight: typography.fontWeight.semibold,
  },
});
