import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing } from '../theme';

/**
 * Standart header: sol tesis + paket, orta ekran başlığı (opsiyonel), sağ bildirim + profil.
 * Altında kısa durum satırı: Sunucu bağlı / KBS yapılandırılmadı / Backend bağlantı yok.
 */
export default function AppHeader({
  title,
  tesis,
  backendOnline = null,
  kbsConfigured = null,
  onNotification,
  onProfile,
  rightComponent,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const statusLine = React.useMemo(() => {
    if (backendOnline === false) return { text: 'Backend bağlantı yok', icon: 'close-circle', type: 'error' };
    if (kbsConfigured === false) return { text: 'KBS yapılandırılmadı', icon: 'warning', type: 'warning' };
    if (backendOnline === true) return { text: 'Sunucu bağlı', icon: 'checkmark-circle', type: 'success' };
    return null;
  }, [backendOnline, kbsConfigured]);

  const statusColor = statusLine?.type === 'error' ? colors.error : statusLine?.type === 'warning' ? colors.warning : colors.success;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: insets.top }]}>
      <View style={[styles.row, { minHeight: spacing.headerHeight }]}>
        <View style={styles.left}>
          <Text style={[styles.tesisName, { color: colors.textPrimary }]} numberOfLines={1}>
            {tesis?.tesisAdi || tesis?.adi || 'Tesis'}
          </Text>
          {(tesis?.paket || tesis?.kota) && (
            <Text style={[styles.package, { color: colors.textSecondary }]} numberOfLines={1}>
              {[tesis?.paket, tesis?.kota ? `Kota: ${tesis.kullanilanKota ?? 0}/${tesis.kota}` : null].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {title ? (
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <View style={styles.right}>
          {rightComponent ?? (
            <>
              <TouchableOpacity onPress={onNotification} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onProfile} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="person-circle-outline" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
      {statusLine && (
        <View style={[styles.statusLine, { borderTopColor: colors.border }]}>
          <Ionicons name={statusLine.icon} size={14} color={statusColor} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLine.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    borderBottomColor: undefined,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xs,
  },
  left: { flex: 1, minWidth: 0 },
  tesisName: {
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
  },
  iconBtn: { padding: spacing.xs },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 6,
    gap: 6,
    borderTopWidth: 1,
  },
  statusText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.fontWeight.medium,
  },
});
