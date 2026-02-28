/**
 * Oda kartı — modern: solda durum bandı, oda no + tip, kısa durum satırı, tek contextual buton
 * Mini ikonlar: ödeme, MRZ tamam mı, not var mı, erken giriş
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme, spacing } from '../../theme';

function getStatusLabel(durum) {
  switch (durum) {
    case 'bos': return 'Boş';
    case 'dolu': return 'Dolu';
    case 'temizlik': return 'Temizlik';
    case 'bakim': return 'Bakım';
    default: return '—';
  }
}

function getShortStatusLine(item, getStatusColor) {
  if (item.durum === 'bos') {
    return 'Hazır · Satışa açık';
  }
  if (item.durum === 'dolu' && item.misafir) {
    const cikis = item.misafir.cikisTarihi
      ? new Date(item.misafir.cikisTarihi)
      : null;
    const gunKaldi = cikis
      ? Math.ceil((cikis - new Date()) / (24 * 60 * 60 * 1000))
      : null;
    const saat = cikis ? cikis.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const kisi = item.kapasite ? `${item.kapacite} kişi` : '2 kişi';
    const gece = gunKaldi != null ? `${gunKaldi} gece kaldı` : '';
    return [kisi, `Çıkış ${saat}`, gece].filter(Boolean).join(' · ');
  }
  if (item.durum === 'temizlik') return 'Temizlik bekliyor';
  if (item.durum === 'bakim') return 'Bakımda';
  return '';
}

function getContextualButton(item) {
  if (item.durum === 'bos') return { label: 'Check-in', icon: 'log-in-outline' };
  if (item.durum === 'dolu') return { label: 'Odaya Git', icon: 'arrow-forward-outline' };
  if (item.durum === 'temizlik') return { label: 'Temizlendi İşaretle', icon: 'checkmark-circle-outline' };
  if (item.durum === 'bakim') return { label: 'Arıza Çözüldü', icon: 'checkmark-done-outline' };
  return { label: 'Detay', icon: 'create-outline' };
}

export default function RoomCardModern({
  item,
  onPress,
  onCheckout,
  getStatusColor,
  getKBSDurumIcon,
  compact,
}) {
  const { colors } = useTheme();
  const statusColor = getStatusColor?.(item.durum) || theme.colors.gray400;
  const statusLabel = getStatusLabel(item.durum);
  const shortLine = getShortStatusLine(item, getStatusColor);
  const btn = getContextualButton(item);

  const handleMainAction = (e) => {
    e?.stopPropagation?.();
    if (item.durum === 'dolu' && btn.label === 'Odaya Git') {
      onPress?.(item);
    } else if (item.durum === 'dolu' && item.misafir && btn.label === 'Çıkış') {
      onCheckout?.(item);
    } else {
      onPress?.(item);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      activeOpacity={0.85}
      onPress={() => onPress(item)}
    >
      {/* Sol ince durum şeridi */}
      <View style={[styles.statusStrip, { backgroundColor: statusColor }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.roomNo, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.odaNumarasi} {item.odaTipi || 'Standart'}
          </Text>
          <View style={styles.miniIcons}>
            {item.kbsDurumu === 'hatali' && (
              <Ionicons name="warning" size={14} color={theme.colors.error} />
            )}
            {item.kbsDurumu === 'basarili' && (
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
            )}
          </View>
        </View>
        <Text style={[styles.shortLine, { color: colors.textSecondary }]} numberOfLines={1}>
          {shortLine || '—'}
        </Text>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={handleMainAction}
          activeOpacity={0.8}
        >
          <Ionicons name={btn.icon} size={16} color={colors.textInverse} />
          <Text style={[styles.ctaText, { color: colors.textInverse }]}>{btn.label}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 100,
    ...theme.spacing.shadow.sm,
  },
  cardCompact: {
    minHeight: 80,
  },
  statusStrip: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomNo: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  miniIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  shortLine: {
    fontSize: 12,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
