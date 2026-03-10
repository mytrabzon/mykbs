/**
 * Canlı istatistik kartları — doluluk, bugün check-in, okutulan belge sayısı
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/colors';

export default function StatsCards({ stats = {} }) {
  const { doluluk = 0, bugunCheckIn = 0, okutulanBelge = 0 } = stats;
  const items = [
    { label: 'Doluluk', value: `${Math.round(doluluk)}%`, color: COLORS.primary },
    { label: 'Bugün check-in', value: String(bugunCheckIn), color: COLORS.success },
    { label: 'Okutulan belge', value: String(okutulanBelge), color: COLORS.secondary },
  ];
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.label} style={[styles.card, { borderTopColor: item.color }]}>
          <Text style={styles.value}>{item.value}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 12,
    borderTopWidth: 3,
  },
  value: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  label: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
});
