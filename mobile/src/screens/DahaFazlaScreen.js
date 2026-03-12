/**
 * "Daha Fazla" menü — Paket satın al, Profil ve Ayarlar, Admin (sadece yetkili hesaplarda)
 */
import React, { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useCredits } from '../context/CreditsContext';
import { useAuth } from '../context/AuthContext';
import { getIsAdminPanelUser } from '../utils/adminAuth';
import { spacing, typography } from '../theme';

const MENU_ITEMS_BASE = [
  { key: 'PaketSatınAl', label: 'Paket satın al', icon: 'pricetag-outline', action: 'paywall' },
  { key: 'PaketGecmisi', label: 'Paket & Kredi geçmişi', icon: 'receipt-outline', route: 'PaketGecmisi' },
  { key: 'Ayarlar', label: 'Profil ve Ayarlar', icon: 'person-circle-outline', route: 'Ayarlar' },
  { key: 'ReceptionistPanel', label: 'KBS Senkronizasyon', icon: 'sync-outline', route: 'ReceptionistPanel' },
  { key: 'AdminPanel', label: 'Admin Panel', icon: 'shield-outline', route: 'AdminPanel', adminOnly: true },
];

export default function DahaFazlaScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { triggerPaywall } = useCredits();
  const { user, refreshMe } = useAuth();
  const isAdmin = getIsAdminPanelUser(user);
  const refreshMeRef = useRef(refreshMe);
  refreshMeRef.current = refreshMe;

  // Ekran odaklandığında kullanıcı verisini yenile (admin yetkisi verildikten sonra buton görünsün). Ref ile refreshMe bağımlılığı yok — sonsuz /auth/me döngüsü önlenir.
  useFocusEffect(
    useCallback(() => {
      if (typeof refreshMeRef.current === 'function') refreshMeRef.current();
    }, [])
  );

  const items = MENU_ITEMS_BASE.filter((item) => !item.adminOnly || isAdmin);

  const onItemPress = (item) => {
    if (item.action === 'paywall') {
      triggerPaywall('menu');
      return;
    }
    if (item.route) {
      // Stack içinde ekranı her seferinde açmak için push kullan (navigate bazen aynı stack’te tepkisiz kalabiliyor)
      if (typeof navigation.push === 'function') {
        navigation.push(item.route);
      } else {
        navigation.navigate(item.route);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]} />
      <View style={styles.list}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onItemPress(item)}
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
