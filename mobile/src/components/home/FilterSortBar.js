/**
 * Filtre çubuğu (chip'ler) + Sıralama
 * Tümü / Boş / Dolu / Temizlik / Bakım / Çıkışa Yakın / Hatalı
 * Sırala: Kat / Oda no / Check-out saat / Temizlik öncelik
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const FILTERS = [
  { key: 'tumu', label: 'Tümü', icon: 'grid-outline' },
  { key: 'bos', label: 'Boş', icon: 'bed-outline' },
  { key: 'dolu', label: 'Dolu', icon: 'bed' },
  { key: 'temizlik', label: 'Temizlik', icon: 'water-outline' },
  { key: 'bakim', label: 'Bakım', icon: 'construct-outline' },
  { key: 'cikisaYakin', label: 'Çıkışa Yakın', icon: 'time-outline' },
  { key: 'hatali', label: 'Hatalı', icon: 'warning-outline' },
];

const SORT_OPTIONS = [
  { key: 'kat', label: 'Kat' },
  { key: 'odaNo', label: 'Oda no' },
  { key: 'checkout', label: 'Check-out saat' },
  { key: 'temizlikOncelik', label: 'Temizlik öncelik' },
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
  const sortLabel = SORT_OPTIONS.find((s) => s.key === sortKey)?.label || 'Sırala';

  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View style={styles.filtersRow}>
        <View style={styles.chipsWrap}>
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
                  size={14}
                  color={isSelected ? colors.textInverse : colors.textSecondary}
                  style={styles.chipIcon}
                />
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? colors.textInverse : colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={[styles.sortRow, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: colors.gray50, borderColor: colors.border }]}
          onPress={onToggleSortMenu}
        >
          <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
          <Text style={[styles.sortLabel, { color: colors.textPrimary }]}>{sortLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    maxWidth: 90,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});
