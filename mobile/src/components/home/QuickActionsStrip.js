/**
 * Hızlı Aksiyonlar — 2 satır, ikonlu pill butonlar
 * Check-in, MRZ Tara, Hızlı Rezervasyon, Oda Değiştir, Sorun Bildir, Misafir Ara
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const ACTIONS = [
  { key: 'aileGiris', label: 'Aile Girişi', icon: 'people', nav: 'FamilyCheckIn' },
  { key: 'mrz', label: 'Hızlı MRZ', icon: 'camera', nav: 'MrzScan' },
  { key: 'checkin', label: 'Check-in', icon: 'log-in-outline', nav: 'MrzScan', params: { fromCheckIn: true } },
  { key: 'odaAta', label: 'Oda Ata', icon: 'bed-outline', nav: 'MrzScan', params: { fromCheckIn: true } },
  { key: 'liste', label: 'Liste', icon: 'list-outline', nav: 'Misafirler' },
];

export default function QuickActionsStrip({ onAction, isCompact }) {
  const { colors } = useTheme();
  const actions = ACTIONS;

  const handlePress = (action) => {
    if (action.nav) onAction?.({ type: 'navigate', route: action.nav, params: action.params });
    else onAction?.({ type: action.key });
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {actions.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handlePress(a)}
            activeOpacity={0.7}
          >
            <Ionicons name={a.icon} size={14} color={colors.primary} />
            <Text style={[styles.pillLabel, { color: colors.textPrimary }]} numberOfLines={1}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
  },
  scrollContent: {
    paddingHorizontal: 0,
    gap: 6,
    paddingRight: spacing.screenPadding + 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
});
