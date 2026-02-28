/**
 * Hızlı Aksiyonlar — 2 satır, ikonlu pill butonlar
 * Check-in, MRZ Tara, Hızlı Rezervasyon, Oda Değiştir, Sorun Bildir, Misafir Ara
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const ACTIONS = [
  { key: 'checkin', label: 'Check-in', icon: 'log-in-outline', nav: 'CheckIn' },
  { key: 'mrz', label: 'MRZ Tara', icon: 'document-text-outline', nav: 'MRZ' },
  { key: 'rezervasyon', label: 'Hızlı Rezervasyon', icon: 'calendar-outline', nav: 'CheckIn' },
  { key: 'odaDegistir', label: 'Oda Değiştir', icon: 'swap-horizontal-outline', nav: null },
  { key: 'sorun', label: 'Sorun Bildir', icon: 'alert-circle-outline', nav: null },
  { key: 'misafirAra', label: 'Misafir Ara', icon: 'people-outline', nav: 'Misafirler' },
];

export default function QuickActionsStrip({ onAction, isCompact }) {
  const { colors } = useTheme();
  const row1 = ACTIONS.slice(0, 3);
  const row2 = ACTIONS.slice(3, 6);

  const handlePress = (action) => {
    if (action.nav) onAction?.({ type: 'navigate', route: action.nav });
    else onAction?.({ type: action.key });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {row1.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[styles.pill, { backgroundColor: colors.gray50, borderColor: colors.border }]}
            onPress={() => handlePress(a)}
            activeOpacity={0.7}
          >
            <Ionicons name={a.icon} size={18} color={colors.primary} />
            <Text style={[styles.pillLabel, { color: colors.textPrimary }]} numberOfLines={1}>
              {isCompact ? a.label.split(' ')[0] : a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.row}>
        {row2.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[styles.pill, { backgroundColor: colors.gray50, borderColor: colors.border }]}
            onPress={() => handlePress(a)}
            activeOpacity={0.7}
          >
            <Ionicons name={a.icon} size={18} color={colors.primary} />
            <Text style={[styles.pillLabel, { color: colors.textPrimary }]} numberOfLines={1}>
              {isCompact ? a.label.split(' ')[0] : a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
