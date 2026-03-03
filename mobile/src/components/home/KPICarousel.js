/**
 * KPI Şeridi — 4–6 akıllı kart (kaydırılabilir)
 * Doluluk, Bugün Giriş, Bugün Çıkış, Temizlik Bekleyen, Ödeme Bekleyen, Hatalı MRZ
 * Tıklanınca ilgili filtre uygulanır.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const CARD_CONFIG = [
  {
    key: 'doluluk',
    filterKey: null,
    icon: 'pie-chart-outline',
    iconBg: 'primarySoft',
    iconColor: 'primary',
    label: 'Doluluk',
    valueKey: 'doluluk',
    suffix: '%',
  },
  {
    key: 'giris',
    filterKey: 'tumu',
    icon: 'log-in-outline',
    iconBg: 'successSoft',
    iconColor: 'success',
    label: 'Bugün Giriş',
    valueKey: 'bugunGiris',
  },
  {
    key: 'cikis',
    filterKey: 'tumu',
    icon: 'log-out-outline',
    iconBg: 'warningSoft',
    iconColor: 'warning',
    label: 'Bugün Çıkış',
    valueKey: 'bugunCikis',
  },
  {
    key: 'temizlik',
    filterKey: 'temizlik',
    icon: 'water-outline',
    iconBg: 'accentSoft',
    iconColor: 'accent',
    label: 'Temizlik',
    valueKey: 'temizlikOda',
  },
  {
    key: 'odeme',
    filterKey: null,
    icon: 'card-outline',
    iconBg: 'warningSoft',
    iconColor: 'warning',
    label: 'Ödeme Bekleyen',
    valueKey: 'odemeBekleyen',
  },
  {
    key: 'hatali',
    filterKey: 'hatali',
    icon: 'warning-outline',
    iconBg: 'errorSoft',
    iconColor: 'error',
    label: 'Hatalı MRZ',
    valueKey: 'hataliBildirim',
  },
];

function getValue(ozet, card, odalarCountByFilter = {}) {
  if (card.valueKey === 'doluluk') {
    if (!ozet?.toplamOda || ozet.toplamOda === 0) return '0';
    const pct = Math.round((ozet.doluOda / ozet.toplamOda) * 100);
    return String(pct);
  }
  if (card.valueKey === 'temizlikOda') {
    return String(odalarCountByFilter.temizlik ?? ozet?.temizlikOda ?? 0);
  }
  if (card.valueKey === 'odemeBekleyen') {
    return String(ozet?.odemeBekleyen ?? 0);
  }
  const v = ozet?.[card.valueKey];
  return v != null ? String(v) : '0';
}

export default function KPICarousel({
  ozet,
  odalarCountByFilter = {},
  onCardPress,
  selectedFilter,
}) {
  const { colors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {CARD_CONFIG.map((card) => {
        const value = getValue(ozet, card, odalarCountByFilter);
        const isSelected =
          (card.filterKey && selectedFilter === card.filterKey) ||
          (card.key === 'doluluk' && selectedFilter === 'dolu');
        const bg = colors[card.iconBg] || colors.primarySoft;
        const iconColor = colors[card.iconColor] || colors.primary;

        return (
          <TouchableOpacity
            key={card.key}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: 2,
                shadowColor: isSelected ? colors.primary : '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: isSelected ? 0.2 : 0.06,
                shadowRadius: 4,
                elevation: isSelected ? 3 : 2,
              },
            ]}
            onPress={() => {
              if (card.filterKey) onCardPress?.(card.filterKey);
              else if (card.key === 'doluluk') onCardPress?.('dolu');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: bg }]}>
              <Ionicons name={card.icon} size={14} color={iconColor} />
            </View>
            <Text style={[styles.value, { color: colors.textPrimary }]}>
              {value}
              {card.suffix || ''}
            </Text>
            <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
              {card.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const CARD_WIDTH = 56;
const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 6,
    paddingRight: spacing.screenPadding + 8,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    minHeight: 48,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: '600',
  },
});
