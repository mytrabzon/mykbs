import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { PAYWALL_PACKAGES, CREDITS_DEPLETED_MESSAGE, TRIAL_END_MESSAGE } from '../constants/packages';

/**
 * 0 kredi veya deneme süresi bitince: "Bildirim hakkın doldu. Devam etmek için paket seç."
 * Altında 3 paket kartı; ortadaki (Pro) hafif glow + "En Çok Tercih Edilen" rozeti.
 */
export default function PaywallModal({ visible, onClose, reason = 'no_credits' }) {
  const { colors } = useTheme();

  const message = reason === 'trial_ended' ? TRIAL_END_MESSAGE : CREDITS_DEPLETED_MESSAGE;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.box, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Bildirim hakkın doldu
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {message}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.cardsScroll} contentContainerStyle={styles.cardsContent} showsVerticalScrollIndicator={false}>
            {PAYWALL_PACKAGES.map((pkg) => {
              const isPro = pkg.id === 'pro';
              return (
                <View
                  key={pkg.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.surfaceCard, borderColor: colors.border },
                    isPro && styles.cardPro,
                    isPro && { borderColor: colors.primary, shadowColor: colors.primary },
                  ]}
                >
                  {pkg.badge ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.badgeText}>{pkg.badge}</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>{pkg.label}</Text>
                  <Text style={[styles.cardCredits, { color: colors.textPrimary }]}>
                    {pkg.credits.toLocaleString('tr-TR')} Bildirim
                  </Text>
                  <Text style={[styles.cardPrice, { color: colors.primary }]}>
                    {pkg.priceTL.toLocaleString('tr-TR')} ₺
                  </Text>
                  {isPro ? (
                    <Text style={[styles.unitPrice, { color: colors.textSecondary }]}>
                      Birim: {(pkg.priceTL / pkg.credits).toFixed(2)} ₺/bildirim
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.cta, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      // TODO: ödeme akışı
                      onClose();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.ctaText}>Seç</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  box: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    paddingTop: 24,
    paddingRight: 44,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  cardsScroll: {
    maxHeight: 360,
  },
  cardsContent: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 18,
    marginBottom: 12,
    position: 'relative',
  },
  cardPro: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  cardCredits: {
    fontSize: 15,
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  unitPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  cta: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
