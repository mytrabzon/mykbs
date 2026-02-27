import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Modal,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { SegmentedControl, Button, Input } from '../components/ui';
import { typography, spacing } from '../theme';

const APP_PREFIX = 'mykbs';
const STORAGE_KEYS = { TELEFON: `@${APP_PREFIX}:login:telefon` };
const SUPPORT_EMAIL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com';
const SUPPORT_PHONE = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE || '0850 304 5061';
const SUPPORT_PHONE_TEL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE_TEL || 'tel:08503045061';

export default function LoginScreen({ route }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { login, loginWithPassword, loginWithPhoneAndPassword } = useAuth();
  const [tab, setTab] = useState('hesap'); // 'hesap' = telefon/e-posta + şifre (varsayılan), 'tesis' = tesis kodu + PIN
  const [tesisKodu, setTesisKodu] = useState('');
  const [pin, setPin] = useState('');
  const [telefon, setTelefon] = useState('');
  const [sifre, setSifre] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.TELEFON);
        if (saved) setTelefon(saved);
      } catch (e) {}
    })();
    if (route?.params?.testAccount?.telefon) setTelefon(route.params.testAccount.telefon || '');
  }, [route]);

  const formatPhone = (t) => t.replace(/[^\d]/g, '').slice(0, 10);
  const isValidHesap = (v) => {
    if (!v?.trim()) return false;
    const s = v.trim();
    if (s.includes('@')) return s.length >= 5;
    return s.replace(/\D/g, '').length >= 10;
  };

  const handleTesisLogin = async () => {
    if (!tesisKodu?.trim() || !pin?.trim()) {
      Toast.show({ type: 'error', text1: 'Eksik alan', text2: 'Tesis kodu ve PIN giriniz' });
      return;
    }
    setLoading(true);
    setPendingApproval(false);
    try {
      const result = await login(tesisKodu.trim(), pin);
      setLoading(false);
      if (result?.success) {
        Toast.show({ type: 'success', text1: 'Giriş başarılı' });
      } else if (result?.pendingApproval) {
        setPendingApproval(true);
        // Tesis kodu ve PIN sıfırlanmaz (manuel dışında)
      } else {
        Toast.show({ type: 'error', text1: 'Giriş başarısız', text2: result?.message });
      }
    } catch (e) {
      setLoading(false);
      setErrorDetails({ message: e?.message });
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || e?.message });
    }
  };

  const handleCheckApproval = async () => {
    if (!tesisKodu?.trim() || !pin?.trim()) return;
    setCheckingApproval(true);
    try {
      const result = await login(tesisKodu.trim(), pin);
      if (result?.success) {
        setPendingApproval(false);
        Toast.show({ type: 'success', text1: 'Onaylandı', text2: 'Giriş başarılı' });
      } else if (result?.pendingApproval) {
        Toast.show({ type: 'info', text1: 'Henüz onaylanmadı', text2: 'Kısa süre içinde onaylanacaktır.' });
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: result?.message });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || e?.message });
    } finally {
      setCheckingApproval(false);
    }
  };

  const handleHesapLogin = async () => {
    const isEmail = (telefon || '').trim().includes('@');
    const rawPhone = (telefon || '').replace(/\D/g, '');
    const isPhone = !isEmail && rawPhone.length >= 10;

    if (!isEmail && !isPhone) {
      Toast.show({ type: 'error', text1: 'Geçersiz giriş', text2: 'E-posta veya 10 haneli telefon numarası giriniz.' });
      return;
    }
    if (!sifre || sifre.length < 6) {
      Toast.show({ type: 'error', text1: 'Şifre', text2: 'En az 6 karakter giriniz' });
      return;
    }
    setLoading(true);
    try {
      if (telefon) await AsyncStorage.setItem(STORAGE_KEYS.TELEFON, telefon);
      const result = isEmail
        ? await loginWithPassword(telefon.trim(), sifre)
        : await loginWithPhoneAndPassword(telefon.trim(), sifre);
      setLoading(false);
      if (result?.success) Toast.show({ type: 'success', text1: 'Giriş başarılı' });
      else Toast.show({ type: 'error', text1: 'Giriş başarısız', text2: result?.message });
    } catch (e) {
      setLoading(false);
      setErrorDetails({ message: e?.message });
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || e?.message });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle={colors.background === '#0F172A' ? 'light-content' : 'dark-content'} backgroundColor={colors.primary} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={[styles.logoWrap, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="hotel" size={36} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>KBS Yönetim Paneli</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <SegmentedControl
            options={[
              { key: 'hesap', label: 'Telefon / E-posta + Şifre' },
              { key: 'tesis', label: 'Tesis Kodu + PIN' },
            ]}
            value={tab}
            onChange={setTab}
            style={styles.segmented}
          />

          {tab === 'tesis' ? (
            <>
              <Input
                label="Tesis Kodu"
                value={tesisKodu}
                onChangeText={(t) => { setTesisKodu(t); setPendingApproval(false); }}
                placeholder=""
                autoCapitalize="characters"
              />
              <Input
                label="PIN"
                value={pin}
                onChangeText={(t) => { setPin(t); setPendingApproval(false); }}
                placeholder=""
                secureTextEntry
                keyboardType="numeric"
              />
              {pendingApproval ? (
                <View style={[styles.pendingBox, { backgroundColor: colors.gray100 || '#f1f5f9', borderColor: colors.border }]}>
                  <View style={[styles.statusDot, { backgroundColor: colors.textSecondary }]} />
                  <Text style={[styles.pendingTitle, { color: colors.textPrimary }]}>Admin onayına sunuldu</Text>
                  <Text style={[styles.pendingMessage, { color: colors.textSecondary }]}>
                    Onaylandığı an bildirim yapabileceksin. Çok kısa sürecek.{'\n'}
                    Onaydan sonra yeşil gösterge ile giriş yapabileceksin.
                  </Text>
                  <Button variant="secondary" onPress={handleCheckApproval} loading={checkingApproval} disabled={checkingApproval}>
                    Durumu kontrol et
                  </Button>
                </View>
              ) : null}
              <Button
                variant="primary"
                onPress={handleTesisLogin}
                loading={loading}
                disabled={loading || !tesisKodu?.trim() || !pin?.trim()}
              >
                Giriş Yap
              </Button>
            </>
          ) : (
            <>
              <Input
                label="Telefon veya E-posta"
                value={telefon}
                onChangeText={(t) => setTelefon(t.includes('@') ? t : formatPhone(t))}
                placeholder="05XX XXX XX XX veya e-posta"
                keyboardType={telefon?.includes('@') ? 'email-address' : 'phone-pad'}
                autoCapitalize="none"
              />
              <Input
                label="Şifre"
                value={sifre}
                onChangeText={setSifre}
                placeholder=""
                secureTextEntry={!showPassword}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                }
              />
              <Button
                variant="primary"
                onPress={handleHesapLogin}
                loading={loading}
                disabled={
                  loading ||
                  !(telefon || '').trim() ||
                  ((telefon || '').includes('@') ? !(telefon || '').trim() : (telefon || '').replace(/\D/g, '').length < 10) ||
                  !sifre
                }
              >
                Giriş Yap
              </Button>
              <TouchableOpacity
                style={styles.smsLinkWrap}
                onPress={() => navigation.navigate('OTPVerify', { islemTipi: 'giris' })}
                disabled={loading}
              >
                <Text style={[styles.smsLinkText, { color: colors.primary }]}>SMS kodu ile giriş</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={[styles.secureNote, { color: colors.textSecondary }]}>
            Veriler şifreli iletilir.
          </Text>

          {errorDetails && (
            <TouchableOpacity onPress={() => setShowErrorModal(true)} style={styles.errorLink}>
              <Ionicons name="information-circle-outline" size={18} color={colors.error} />
              <Text style={[styles.errorLinkText, { color: colors.error }]}>Hata detayları</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={[styles.footerLink, { color: colors.primary }]}>Şifremi unuttum</Text>
            </TouchableOpacity>
            <Text style={[styles.footerSupport, { color: colors.textSecondary }]}>
              Destek:{' '}
              <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text>
              {' · '}
              <Text style={{ color: colors.primary }} onPress={() => Linking.openURL(SUPPORT_PHONE_TEL)}>{SUPPORT_PHONE}</Text>
            </Text>
          </View>

          <View style={styles.registerRow}>
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>Hesabınız yok mu?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Kayit')}>
              <Text style={[styles.registerLink, { color: colors.primary }]}>Kayıt ol</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={showErrorModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Hata Detayları</Text>
              <TouchableOpacity onPress={() => setShowErrorModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {errorDetails && (
                <Text style={[styles.modalBodyText, { color: colors.textPrimary }]}>{errorDetails.message || 'Bilinmeyen hata'}</Text>
              )}
            </ScrollView>
            <Button variant="primary" onPress={() => setShowErrorModal(false)}>Kapat</Button>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing['3xl'] },
  hero: {
    paddingTop: spacing['4xl'] + 8,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontSize: typography.text.h1.fontSize,
    fontWeight: typography.fontWeight.semibold,
    color: '#FFFFFF',
  },
  formCard: {
    marginHorizontal: spacing.screenPadding,
    marginTop: -16,
    borderRadius: 16,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  segmented: { marginBottom: spacing.lg },
  pendingBox: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  pendingTitle: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  pendingMessage: {
    fontSize: typography.text.caption.fontSize,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  smsLinkWrap: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  smsLinkText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: '600',
  },
  secureNote: {
    fontSize: typography.text.caption.fontSize,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  errorLinkText: { fontSize: typography.text.caption.fontSize },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerLink: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  footerSupport: {
    fontSize: typography.text.caption.fontSize,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  registerText: { fontSize: typography.text.body.fontSize },
  registerLink: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: typography.text.h2.fontSize, fontWeight: '600' },
  modalBody: { maxHeight: 200, marginBottom: spacing.md },
  modalBodyText: { fontSize: typography.text.body.fontSize },
});
