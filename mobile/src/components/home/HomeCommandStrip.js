/**
 * Komuta Şeridi — sticky üst bölüm
 * Sol: Otel adı + mini durum (Bugün: X giriş, Y çıkış)
 * Orta: Tarih seçici (Bugün / Yarın / Takvim)
 * Sağ: Bildirim + Profil
 * Alt: global arama (oda no / misafir adı / rezervasyon kodu)
 * Scroll'da compact moda geçer (padding küçülür)
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
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
  scrollY = new Animated.Value(0),
  onNotification,
  onProfile,
  onSearch,
  onDateChange,
  selectedDateKey = 'bugun',
  commandMode,
  onCommandModeChange,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const miniStatus =
    ozet && ozet.toplamOda != null
      ? `Bugün: ${ozet.bugunGiris ?? 0} giriş, ${ozet.bugunCikis ?? 0} çıkış`
      : '';

  const handleSearchSubmit = () => {
    onSearch?.(searchQuery.trim());
  };

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Üst satır: Sol (otel + mini) | Orta (tarih) | Sağ (ikonlar) */}
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[styles.tesisName, { color: colors.textPrimary }]} numberOfLines={1}>
            {tesis?.tesisAdi || tesis?.adi || 'Tesis'}
          </Text>
          {miniStatus ? (
            <Text style={[styles.miniStatus, { color: colors.textSecondary }]} numberOfLines={1}>
              {miniStatus}
            </Text>
          ) : null}
        </View>

        <View style={styles.dateRow}>
          {DATE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.dateChip,
                {
                  backgroundColor: selectedDateKey === opt.key ? colors.primary : colors.gray50,
                  borderColor: selectedDateKey === opt.key ? colors.primary : colors.border,
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
              style={[styles.commandModeBtn, { backgroundColor: commandMode ? colors.primary : colors.gray50 }]}
            >
              <Ionicons name="grid-outline" size={18} color={commandMode ? colors.textInverse : colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onNotification != null && (
            <TouchableOpacity
              onPress={onNotification}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onProfile != null && (
            <TouchableOpacity
              onPress={onProfile}
              style={styles.iconBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Global arama */}
      <View style={[styles.searchWrap, { backgroundColor: colors.gray50, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Oda no, misafir adı, rezervasyon kodu..."
          placeholderTextColor={colors.textDisabled}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  left: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  tesisName: {
    fontSize: typography.text.h2.fontSize,
    fontWeight: typography.fontWeight.semibold,
  },
  miniStatus: {
    fontSize: typography.text.caption.fontSize,
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  iconBtn: {
    padding: 4,
    marginLeft: 4,
  },
  commandModeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.text.body.fontSize,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? {} : { paddingHorizontal: 0 }),
  },
});
