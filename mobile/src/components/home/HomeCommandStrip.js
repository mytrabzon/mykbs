/**
 * Komuta Şeridi — kompakt üst bölüm
 * Satır 1: Tesis adı | Tarih (Bugün/Yarın/Takvim) | Bildirim | Profil
 * Satır 2 (header tam altı): bottomContent — çerçeveli filtre/KPI/aksiyon butonları
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const DATE_OPTIONS = [
  { key: 'bugun', label: 'Bugün' },
  { key: 'yarin', label: 'Yarın' },
  { key: 'takvim', label: 'Takvim' },
];

export default function HomeCommandStrip({
  tesis,
  ozet,
  onNotification,
  onProfile,
  onDateChange,
  selectedDateKey = 'bugun',
  commandMode,
  onCommandModeChange,
  /** Profil/bildirim satırının hemen altında render edilir — çerçeveli buton şeridi */
  bottomContent,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 4,
          paddingBottom: bottomContent ? 0 : 6,
          backgroundColor: colors.surface,
          borderBottomWidth: bottomContent ? 0 : 1,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={[styles.row, { minHeight: 40 }]}>
        <View style={styles.left}>
          <Text style={[styles.tesisName, { color: colors.textPrimary }]} numberOfLines={1}>
            {tesis?.tesisAdi || tesis?.adi || 'Tesis'}
          </Text>
        </View>
        <View style={styles.dateRow}>
          {DATE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.dateChip,
                {
                  backgroundColor: selectedDateKey === opt.key ? colors.primary : colors.surface,
                  borderColor: selectedDateKey === opt.key ? colors.primary : colors.border,
                  borderWidth: 1,
                },
              ]}
              onPress={() => onDateChange?.(opt.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dateChipText,
                  { color: selectedDateKey === opt.key ? colors.textInverse : colors.textSecondary },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.right}>
          {onCommandModeChange != null && (
            <TouchableOpacity
              onPress={() => onCommandModeChange(!commandMode)}
              style={[styles.commandModeBtn, { backgroundColor: commandMode ? colors.primary : colors.surface, borderColor: colors.border, borderWidth: 1 }]}
            >
              <Ionicons name="grid-outline" size={16} color={commandMode ? colors.textInverse : colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onNotification != null && (
            <TouchableOpacity onPress={onNotification} style={[styles.iconBtn, styles.iconBtnFramed, { borderColor: colors.border }]} hitSlop={8}>
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onProfile != null && (
            <TouchableOpacity onPress={onProfile} style={[styles.iconBtn, styles.iconBtnFramed, { borderColor: colors.border }]} hitSlop={8}>
              <Ionicons name="person-circle-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {bottomContent ? (
        <View style={[styles.toolbarWrap, { backgroundColor: colors.gray50, borderBottomColor: colors.border }]}>
          {bottomContent}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  tesisName: {
    fontSize: 17,
    fontWeight: typography.fontWeight.semibold,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  iconBtn: {
    padding: 4,
    marginLeft: 2,
  },
  iconBtnFramed: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 4,
  },
  commandModeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  toolbarWrap: {
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 0,
    marginHorizontal: -spacing.screenPadding,
    paddingHorizontal: spacing.screenPadding,
  },
});
