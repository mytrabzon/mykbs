/**
 * Oda Detay Bottom Sheet — kart tıklanınca %70 yükseklikte açılır
 * Üst: oda başlığı + durum, hızlı aksiyonlar, misafir + MRZ, notlar, "Tam sayfaya git"
 * Overlay tıklanınca hemen kapanmayı engellemek için açılıştan sonra kısa gecikme uygulanır.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.7);
const OVERLAY_CLOSE_DELAY_MS = 350;

export default function RoomDetailSheet({
  visible,
  room,
  onClose,
  onCheckout,
  onUzat,
  onOdaDegistir,
  onFatura,
  onGoToFullPage,
  getStatusColor,
  getStatusLabel,
  getKBSDurumText,
}) {
  const { colors } = useTheme();
  const [allowOverlayClose, setAllowOverlayClose] = useState(false);

  useEffect(() => {
    if (visible) {
      setAllowOverlayClose(false);
      const t = setTimeout(() => setAllowOverlayClose(true), OVERLAY_CLOSE_DELAY_MS);
      return () => clearTimeout(t);
    } else {
      setAllowOverlayClose(false);
    }
  }, [visible]);

  if (!room) return null;

  const isDolu = room.durum === 'dolu';
  const isBos = room.durum === 'bos';
  const isTemizlik = room.durum === 'temizlik';
  const isBakim = room.durum === 'bakim';
  const statusColor = getStatusColor?.(room.durum) || colors.gray400;
  const statusLabel = getStatusLabel?.(room.durum) || room.durum;

  const handleOverlayPress = () => {
    if (allowOverlayClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={[styles.handleWrap, { backgroundColor: colors.border }]}>
            <View style={[styles.handle, { backgroundColor: colors.textSecondary }]} />
          </View>

          {/* Başlık + durum */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTop}>
              <Text style={[styles.roomTitle, { color: colors.textPrimary }]}>
                Oda {room.odaNumarasi} · {room.odaTipi || 'Standart'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.statusBand, { backgroundColor: statusColor }]}>
              <Text style={styles.statusBandText}>{statusLabel}</Text>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hızlı aksiyonlar */}
            <View style={styles.actionsRow}>
              {isDolu && (
                <>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.errorSoft }]}
                    onPress={onCheckout}
                  >
                    <Ionicons name="log-out-outline" size={20} color={colors.error} />
                    <Text style={[styles.actionBtnText, { color: colors.error }]}>Çıkış</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]}
                    onPress={onUzat}
                  >
                    <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Uzat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]}
                    onPress={onOdaDegistir}
                  >
                    <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Oda Değiştir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primarySoft }]}
                    onPress={onFatura}
                  >
                    <Ionicons name="receipt-outline" size={20} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Fatura</Text>
                  </TouchableOpacity>
                </>
              )}
              {isBos && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={onGoToFullPage}
                >
                  <Ionicons name="log-in-outline" size={20} color={colors.textInverse} />
                  <Text style={[styles.actionBtnText, { color: colors.textInverse }]}>Check-in</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Misafir bilgisi */}
            {room.misafir && (
              <View style={[styles.block, { backgroundColor: colors.gray50, borderColor: colors.border }]}>
                <Text style={[styles.blockTitle, { color: colors.textSecondary }]}>Misafir</Text>
                <Text style={[styles.guestName, { color: colors.textPrimary }]}>
                  {room.misafir.ad} {room.misafir.soyad}
                </Text>
                <Text style={[styles.guestMeta, { color: colors.textSecondary }]}>
                  Giriş: {new Date(room.misafir.girisTarihi).toLocaleDateString('tr-TR')}
                  {room.misafir.cikisTarihi
                    ? ` · Çıkış: ${new Date(room.misafir.cikisTarihi).toLocaleDateString('tr-TR')}`
                    : ''}
                </Text>
                {room.kbsDurumu && (
                  <Text style={[styles.mrzStatus, { color: colors.textSecondary }]}>
                    MRZ: {getKBSDurumText?.(room.kbsDurumu) || room.kbsDurumu}
                  </Text>
                )}
              </View>
            )}

            {/* Tam sayfaya git */}
            <TouchableOpacity
              style={[styles.fullPageLink, { borderColor: colors.border }]}
              onPress={onGoToFullPage}
            >
              <Text style={[styles.fullPageLinkText, { color: colors.primary }]}>
                Tam sayfaya git
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </TouchableOpacity>
          </ScrollView>
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
    height: SHEET_HEIGHT,
    maxHeight: SHEET_HEIGHT,
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
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomTitle: {
    fontSize: typography.text.h2Large.fontSize,
    fontWeight: '600',
  },
  statusBand: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  statusBandText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: spacing.screenPadding,
    paddingBottom: 40,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  block: {
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  guestName: {
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: '600',
    marginBottom: 4,
  },
  guestMeta: {
    fontSize: 12,
  },
  mrzStatus: {
    fontSize: 12,
    marginTop: 6,
  },
  fullPageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    gap: 6,
  },
  fullPageLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
