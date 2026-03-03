/**
 * Filtre çubuğu — tek satır yatay kaydırmalı, çerçeveli chip'ler
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing } from '../../theme';

const FILTERS = [
  { key: 'tumu', label: 'Tümü', icon: 'grid-outline' },
  { key: 'bos', label: 'Boş', icon: 'bed-outline' },
  { key: 'dolu', label: 'Dolu', icon: 'bed' },
  { key: 'temizlik', label: 'Temizlik', icon: 'water-outline' },
  { key: 'bakim', label: 'Bakım', icon: 'construct-outline' },
  { key: 'cikisaYakin', label: 'Çıkışa Yakın', icon: 'time-outline' },
  { key: 'hatali', label: 'Hatalı', icon: 'warning-outline' },
];

export default function FilterSortBar({
  selectedFilter,
  onFilterChange,
  sortKey,
  onSortChange,
  showSortMenu,
  onToggleSortMenu,
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { borderColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {FILTERS.map((f) => {
          const isSelected = selectedFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onFilterChange?.(f.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={f.icon}
                size={11}
                color={isSelected ? colors.textInverse : colors.textSecondary}
                style={styles.chipIcon}
              />
              <Text
                style={[styles.chipText, { color: isSelected ? colors.textInverse : colors.textSecondary }]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingLeft: 4,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: spacing.screenPadding,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: 3,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
