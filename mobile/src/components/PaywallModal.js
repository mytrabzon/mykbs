import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import {
  PAYWALL_PACKAGES,
  CREDITS_DEPLETED_MESSAGE,
  TRIAL_END_MESSAGE,
} from '../constants/packages';
import { getProductIdForPackage } from '../constants/iapProducts';
import { api } from '../services/api';
import { getApiErrorMessage } from '../services/apiSupabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 20;
const SHEET_MAX = Math.min(SCREEN_WIDTH, 440);
const CONTENT_WIDTH = SHEET_MAX - HORIZONTAL_PADDING * 2;
const CARD_WIDTH = (CONTENT_WIDTH - CARD_GAP) / 2;

/**
 * Bildirim paketleri — modern paywall (menü veya kredi bitince).
 */
export default function PaywallModal({ visible, onClose, reason = 'no_credits' }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loadingPackageId, setLoadingPackageId] = useState(null);
  const [success, setSuccess] = useState(null);

  const fromMenu = reason === 'menu';
  const message =
    reason === 'trial_ended' ? TRIAL_END_MESSAGE : CREDITS_DEPLETED_MESSAGE;
  const isIapSuccess = success && success.iap === true;
  const title = success
    ? isIapSuccess
      ? 'Kredi tanımlandı'
      : 'Siparişiniz alındı'
    : fromMenu
      ? 'Bildirim paketleri'
      : 'Bildirim hakkın doldu';
  const subtitleText = success
    ? isIapSuccess
      ? `Sipariş no: ${success.siparisNo}. ${success.kredi != null ? success.kredi + ' bildirim kredisi hesabınıza eklendi.' : ''} ${success.kalanKredi != null ? 'Kalan: ' + success.kalanKredi : ''}`
      : `Sipariş no: ${success.siparisNo}. Ödeme bilgisi e-posta veya SMS ile iletilecektir. (${success.tutarTL} ₺)`
    : fromMenu
      ? 'İhtiyacına uygun paketi seç'
      : message;

  const pendingIapRef = useRef(null);
  const iapListenerRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    let RNIap;
    try {
      RNIap = require('react-native-iap');
    } catch (_) {
      return;
    }
    const purchaseErrorSub = RNIap.purchaseErrorListener?.((err) => {
      if (pendingIapRef.current) {
        setLoading(false);
        setLoadingPackageId(null);
        pendingIapRef.current = null;
        if (err?.code !== 'E_USER_CANCELLED') {
          Alert.alert('Satın alma hatası', err?.message || 'İşlem başarısız.');
        }
      }
    });

    const sub = RNIap.purchaseUpdatedListener(async (purchase) => {
      const pending = pendingIapRef.current;
      if (!pending) return;
      try {
        const platform = Platform.OS;
        const productId = purchase.productId || purchase.productIdentifier;
        const body =
          platform === 'ios'
            ? {
                platform: 'ios',
                receipt: purchase.transactionReceipt || purchase.transactionReceiptIOS,
                productId,
              }
            : {
                platform: 'android',
                productId,
                purchaseToken: purchase.purchaseToken,
                packageName: 'com.litxtech.mykbs',
              };
        if (!body.receipt && !body.purchaseToken) {
          Alert.alert('Hata', 'Satın alma bilgisi alınamadı.');
          return;
        }
        const { data } = await api.post('/siparis/iap-verify', body);
        setSuccess({
          iap: true,
          siparisNo: data.siparisNo,
          kredi: data.kredi,
          kalanKredi: data.ozet?.kalanKredi,
        });
        try {
          await RNIap.finishTransaction?.({ purchase }, true);
        } catch (_) {}
      } catch (err) {
        Alert.alert('Doğrulama hatası', getApiErrorMessage(err));
      } finally {
        setLoading(false);
        setLoadingPackageId(null);
        pendingIapRef.current = null;
      }
    });
    iapListenerRef.current = { sub, purchaseErrorSub };
    return () => {
      sub?.remove?.();
      purchaseErrorSub?.remove?.();
      iapListenerRef.current = null;
    };
  }, []);

  const handleSatınAl = async (pkg) => {
    setLoading(true);
    setLoadingPackageId(pkg.id);
    setSuccess(null);
    const platform = Platform.OS;
    const useIap = platform === 'ios' || platform === 'android';

    if (useIap) {
      try {
        const RNIap = require('react-native-iap');
        const productId = getProductIdForPackage(pkg.id, platform);
        if (!productId) {
          throw new Error('Bu paket için mağaza ürünü tanımlı değil.');
        }
        let connected = false;
        try {
          await RNIap.initConnection?.();
          connected = true;
        } catch (_) {}
        if (!connected) throw new Error('Mağaza bağlantısı kurulamadı.');
        pendingIapRef.current = { pkg };
        await RNIap.requestPurchase({ sku: productId });
        return;
      } catch (err) {
        const msg = err?.message || getApiErrorMessage(err);
        Alert.alert('Satın alınamadı', msg, [{ text: 'Tamam', style: 'cancel' }]);
        setLoading(false);
        setLoadingPackageId(null);
        return;
      }
    }

    await handleManualOrder(pkg);
  };

  const handleManualOrder = async (pkg) => {
    setLoading(true);
    setLoadingPackageId(pkg.id);
    setSuccess(null);
    try {
      const { data } = await api.post('/siparis', { paket: pkg.id });
      setSuccess({ siparisNo: data.siparisNo, tutarTL: data.tutarTL });
    } catch (err) {
      const msg = getApiErrorMessage(err);
      Alert.alert('Sipariş alınamadı', msg);
    } finally {
      setLoading(false);
      setLoadingPackageId(null);
    }
  };

  const handleClose = () => {
    setSuccess(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              shadowColor: isDark ? 'transparent' : '#0F172A',
            },
          ]}
        >
          {/* Üst çizgi */}
          <View style={[styles.sheetAccent, { backgroundColor: colors.primary }]} />

          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="notifications" size={22} color={colors.primary} />
              </View>
              <View style={styles.headerTitles}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {subtitleText}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: colors.borderLight || colors.border }]}
              hitSlop={12}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {success ? (
            <View style={styles.successBlock}>
              <View style={[styles.successIconWrap, { backgroundColor: colors.successSoft }]}>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              </View>
              <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
                {title}
              </Text>
              <Text style={[styles.successSub, { color: colors.textSecondary }]}>
                Sipariş no: {success.siparisNo}
              </Text>
              <Text style={[styles.successSub, { color: colors.textSecondary }]} numberOfLines={3}>
                {isIapSuccess
                  ? (success.kredi != null ? success.kredi + ' bildirim kredisi hesabınıza eklendi. ' : '') +
                    (success.kalanKredi != null ? 'Kalan: ' + success.kalanKredi : '')
                  : success.tutarTL + ' ₺ — Ödeme bilgisi e-posta veya SMS ile iletilecektir.'}
              </Text>
              <TouchableOpacity
                style={[styles.ctaPrimary, { backgroundColor: colors.primary }]}
                onPress={handleClose}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaPrimaryText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.grid}>
                {PAYWALL_PACKAGES.map((pkg) => {
                  const isPro = pkg.id === 'pro';
                  const isThisLoading = loading && loadingPackageId === pkg.id;
                  const anyLoading = loading;
                  return (
                    <Pressable
                      key={pkg.id}
                      onPress={() => handleSatınAl(pkg)}
                      disabled={anyLoading}
                      style={({ pressed }) => [
                        styles.card,
                        {
                          backgroundColor: isPro
                            ? (colors.primarySoft || colors.surfaceCard)
                            : colors.surfaceCard,
                          borderColor: isPro ? colors.primary : colors.border,
                          borderWidth: isPro ? 2 : 1,
                          opacity: pressed ? 0.92 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        },
                      ]}
                    >
                      {pkg.badge ? (
                        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.badgeText}>{pkg.badge}</Text>
                        </View>
                      ) : null}
                      <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {pkg.label}
                      </Text>
                      <Text style={[styles.cardCredits, { color: colors.textSecondary }]}>
                        {pkg.credits.toLocaleString('tr-TR')} bildirim
                      </Text>
                      <View style={styles.cardPriceRow}>
                        <Text style={[styles.cardPrice, { color: colors.primary }]}>
                          {pkg.priceTL.toLocaleString('tr-TR')} ₺
                        </Text>
                        {isPro && (
                          <Text style={[styles.unitPrice, { color: colors.textSecondary }]}>
                            {(pkg.priceTL / pkg.credits).toFixed(2)} ₺/adet
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.ctaWrap,
                          {
                            backgroundColor: colors.primary,
                            opacity: isThisLoading ? 0.8 : 1,
                          },
                        ]}
                      >
                        {isThisLoading ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <Text style={styles.ctaText}>Satın al</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 24,
  },
  sheetAccent: {
    height: 4,
    width: 48,
    alignSelf: 'center',
    borderRadius: 2,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 16,
    paddingRight: 12,
  },
  headerTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.9,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 20,
    padding: 16,
    marginBottom: CARD_GAP,
    position: 'relative',
    minHeight: 180,
  },
  badge: {
    position: 'absolute',
    top: -8,
    left: 12,
    right: 12,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  cardCredits: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.85,
  },
  cardPriceRow: {
    marginTop: 12,
    marginBottom: 12,
  },
  cardPrice: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unitPrice: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.8,
  },
  ctaWrap: {
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  ctaText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  successBlock: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 32,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  ctaPrimary: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
