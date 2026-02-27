import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing } from '../theme';

/**
 * Bağlantı noktası: yeşil = bağlı, kırmızı = bağlı değil, gri = yapılandırılmadı.
 * Tıklanınca modal ile kullanıcıya not gösterilir.
 */
function StatusDot({ configured, isOnline, error, label, onPress }) {
  const { colors } = useTheme();
  const dotColor = !configured ? colors.textSecondary : isOnline ? colors.success : colors.error;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.dotWrap, { backgroundColor: dotColor }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel={`${label}: ${!configured ? 'yapılandırılmadı' : isOnline ? 'bağlı' : 'bağlı değil'}`}
    />
  );
}

/**
 * Standart header: sol tesis + paket, orta başlık, sağda bağlantı noktaları (Backend · Supabase) + bildirim + profil.
 * Noktalar: yeşil = bağlı, kırmızı = bağlı değil, gri = yapılandırılmadı. Tıklanınca durum notu modalı açılır.
 */
export default function AppHeader({
  title,
  tesis,
  variant = 'default',
  backendConfigured = false,
  backendOnline = null,
  backendError = null,
  supabaseConfigured = false,
  supabaseOnline = null,
  supabaseError = null,
  kbsConfigured = null,
  onNotification,
  onProfile,
  onBack,
  rightComponent,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });

  const showNote = (source) => {
    if (source === 'backend') {
      if (!backendConfigured) {
        setModalContent({ title: 'Backend', body: 'Backend adresi yapılandırılmadı. EXPO_PUBLIC_BACKEND_URL tanımlanmamış.' });
      } else if (backendOnline === true) {
        setModalContent({ title: 'Backend', body: 'Backend sunucusu ile bağlantı başarılı.' });
      } else {
        setModalContent({ title: 'Backend', body: backendError || 'Backend sunucusuna ulaşılamıyor.' });
      }
    } else {
      if (!supabaseConfigured) {
        setModalContent({ title: 'Supabase', body: 'Supabase yapılandırılmadı. EXPO_PUBLIC_SUPABASE_URL tanımlanmamış.' });
      } else if (supabaseOnline === true) {
        setModalContent({ title: 'Supabase', body: 'Supabase ile bağlantı başarılı.' });
      } else {
        setModalContent({ title: 'Supabase', body: supabaseError || 'Supabase servisine ulaşılamıyor.' });
      }
    }
    setModalVisible(true);
  };

  const isPrimary = variant === 'primary';
  return (
    <View style={[styles.wrap, { backgroundColor: isPrimary ? colors.primary : colors.surface, borderBottomWidth: 0, paddingTop: insets.top }]}>
      <View style={[styles.row, { minHeight: spacing.headerHeight }]}>
        <View style={styles.left}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="arrow-back" size={24} color={isPrimary ? '#FFF' : colors.textPrimary} />
            </TouchableOpacity>
          ) : (
            <Text style={[styles.tesisName, { color: isPrimary ? '#FFF' : colors.textPrimary }]} numberOfLines={1}>
              {tesis?.tesisAdi || tesis?.adi || 'Tesis'}
            </Text>
          )}
          {(tesis?.paket || tesis?.kota) && !onBack && (
            <Text style={[styles.package, { color: isPrimary ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]} numberOfLines={1}>
              {[tesis?.paket, tesis?.kota ? `Kota: ${tesis.kullanilanKota ?? 0}/${tesis.kota}` : null].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
        {title ? (
          <Text style={[styles.title, { color: isPrimary ? '#FFF' : colors.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        <View style={styles.right}>
          <View style={styles.dotsRow}>
            <StatusDot
              configured={backendConfigured}
              isOnline={backendOnline}
              error={backendError}
              label="Backend"
              onPress={() => showNote('backend')}
            />
            <View style={[styles.dotDivider, { backgroundColor: colors.border }]} />
            <StatusDot
              configured={supabaseConfigured}
              isOnline={supabaseOnline}
              error={supabaseError}
              label="Supabase"
              onPress={() => showNote('supabase')}
            />
          </View>
          {rightComponent ?? (
            <>
              <TouchableOpacity onPress={onNotification} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="notifications-outline" size={22} color={isPrimary ? '#FFF' : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onProfile} style={styles.iconBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Ionicons name="person-circle-outline" size={24} color={isPrimary ? '#FFF' : colors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{modalContent.title}</Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>{modalContent.body}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Tamam</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  dotWrap: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotDivider: {
    width: 1,
    height: 10,
    marginHorizontal: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.lg,
  },
  modalTitle: {
    ...typography.text.h2,
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontSize: typography.text.body.fontSize,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  modalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.medium,
  },
});
