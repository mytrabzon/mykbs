/**
 * FAB + half-sheet menü
 * Yeni rezervasyon, Walk-in check-in, Misafir ekle, Oda ekle (admin), Arıza kaydı
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const HALF_SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.45);

const MENU_ITEMS = [
  { key: 'rezervasyon', label: 'Yeni rezervasyon', icon: 'calendar-outline', nav: 'CheckIn' },
  { key: 'walkin', label: 'Walk-in check-in', icon: 'log-in-outline', nav: 'CheckIn' },
  { key: 'misafirEkle', label: 'Misafir ekle', icon: 'person-add-outline', nav: 'CheckIn' },
  { key: 'odaEkle', label: 'Oda ekle', icon: 'add-circle-outline', nav: 'AddRoom', adminOnly: true },
  { key: 'ariza', label: 'Arıza kaydı', icon: 'alert-circle-outline', nav: null },
];

export default function FABHalfSheet({
  visible,
  onClose,
  onSelect,
  isAdmin,
}) {
  const { colors } = useTheme();
  const items = MENU_ITEMS.filter((i) => !i.adminOnly || isAdmin);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handleWrap, { backgroundColor: colors.border }]}>
            <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
          </View>
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Hızlı işlem</Text>
          {items.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => {
                onClose();
                if (item.nav) onSelect?.({ type: 'navigate', route: item.nav });
                else onSelect?.({ type: item.key });
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name={item.icon} size={22} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: HALF_SHEET_HEIGHT,
    paddingBottom: spacing.xl,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: typography.text.h2.fontSize,
    fontWeight: '600',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    gap: 12,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: '500',
  },
});
