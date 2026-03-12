import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotificationUnread } from '../context/NotificationContext';
import { getIsAdminPanelUser } from '../utils/adminAuth';
import { typography, spacing } from '../theme';

/**
 * Standart header: sol tesis + paket, orta başlık, sağda bildirim + profil.
 */
export default function AppHeader({
  title,
  tesis,
  variant = 'default',
  hideTesisAndTitle = false,
  /** Sadece başlık + bildirim + profil (tesis/paket gizlenir) */
  minimal = false,
  onNotification,
  onProfile,
  onBack,
  rightComponent,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { unreadCount } = useNotificationUnread();
  const isSuperAdmin = getIsAdminPanelUser(user);

  const isPrimary = variant === 'primary';
  return (
    <View style={[styles.wrap, { backgroundColor: isPrimary ? colors.primary : colors.surface, borderBottomWidth: 0, paddingTop: insets.top }]}>
      <View style={[styles.row, { minHeight: spacing.headerHeight }]}>
        <View style={[styles.left, onBack && styles.leftWithBack]}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconBtnBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="arrow-back" size={24} color={isPrimary ? '#FFF' : colors.textPrimary} />
            </TouchableOpacity>
          ) : !hideTesisAndTitle && !minimal ? (
            <>
              <Text style={[styles.tesisName, { color: isPrimary ? '#FFF' : colors.textPrimary }]} numberOfLines={1}>
                {tesis?.tesisAdi || tesis?.adi || 'Tesis'}
              </Text>
              {(tesis?.paket || tesis?.kota) && (
                <Text style={[styles.package, { color: isPrimary ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]} numberOfLines={1}>
                  {[
                    tesis?.paket,
                    tesis?.kota != null
                      ? `Kalan: ${Math.max(0, (tesis.kota ?? 0) - (tesis.kullanilanKota ?? 0))} bildirim`
                      : null
                  ].filter(Boolean).join(' · ')}
                </Text>
              )}
            </>
          ) : null}
        </View>
        {title ? (
          <Text style={[styles.title, { color: isPrimary ? '#FFF' : colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <View style={styles.right} pointerEvents="box-none">
          {rightComponent ?? (
            <>
              {isSuperAdmin && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('AdminPanel')}
                  style={styles.adminButtonWrap}
                  activeOpacity={0.6}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityLabel="Admin Paneli"
                  accessibilityRole="button"
                >
                  <Ionicons name="shield" size={22} color="#8B5CF6" />
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>A</Text>
                  </View>
                </TouchableOpacity>
              )}
              {onNotification != null && (
                <TouchableOpacity
                  onPress={() => onNotification()}
                  style={styles.iconBtn}
                  activeOpacity={0.6}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityLabel="Bildirimler"
                  accessibilityRole="button"
                >
                  <Ionicons name="notifications-outline" size={22} color={isPrimary ? '#FFF' : colors.textSecondary} />
                  {unreadCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText} numberOfLines={1}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              {onProfile != null && (
                <TouchableOpacity
                  onPress={() => onProfile()}
                  style={styles.iconBtn}
                  activeOpacity={0.6}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  accessibilityLabel="Profil"
                  accessibilityRole="button"
                >
                  <Ionicons name="person-circle-outline" size={24} color={isPrimary ? '#FFF' : colors.textSecondary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
  },
  left: { flex: 1, minWidth: 0 },
  leftWithBack: { marginLeft: -52 },
  iconBtnBack: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 0,
    paddingRight: spacing.xs,
  },
  iconBtn: {
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: typography.fontWeight.semibold,
  },
  package: {
    fontSize: typography.text.caption.fontSize,
    marginTop: 2,
  },
  title: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginHorizontal: spacing.sm,
    maxWidth: 140,
    textAlign: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  iconBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  adminButtonWrap: {
    position: 'relative',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#8B5CF6',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#f43f5e',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
