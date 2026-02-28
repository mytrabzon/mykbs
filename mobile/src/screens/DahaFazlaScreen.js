/**
 * "Daha Fazla" menü — Topluluk, Ayarlar, Admin (yetkili kullanıcıda)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme';

const MENU_ITEMS = [
  { key: 'Topluluk', label: 'Topluluk', icon: 'chatbubbles-outline', route: 'Topluluk' },
  { key: 'Ayarlar', label: 'Ayarlar', icon: 'settings-outline', route: 'Ayarlar' },
  { key: 'AdminPanel', label: 'Admin Panel', icon: 'shield-outline', route: 'AdminPanel' },
];

export default function DahaFazlaScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const items = MENU_ITEMS;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Daha Fazla</Text>
      </View>
      <View style={styles.list}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate(item.route)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name={item.icon} size={22} color={colors.primary} />
            </View>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: typography.text.h2Large.fontSize,
    fontWeight: '600',
  },
  list: {
    padding: spacing.screenPadding,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: '500',
  },
});
