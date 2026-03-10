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
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Input } from '../components/ui';
import { typography, spacing } from '../theme';
import { supabase } from '../lib/supabase/supabase';
import { api } from '../services/api';
import { getEmailOtpErrorMessage } from '../utils/authErrorMessage';

const APP_PREFIX = 'mykbs';
const STORAGE_KEYS = { TELEFON: `@${APP_PREFIX}:login:telefon` };
const SUPPORT_EMAIL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com';
const SUPPORT_PHONE = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE || '0850 304 5061';
const SUPPORT_PHONE_TEL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE_TEL || 'tel:08503045061';

const isValidEmail = (v) => (v || '').trim().length >= 5 && (v || '').trim().includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

export default function LoginScreen({ route }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { loginWithPassword, loginWithToken, loginAsGuest, needsPrivacyConsent, needsTermsConsent } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [kodModu, setKodModu] = useState(false);
  const [otpGonderildi, setOtpGonderildi] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const otpRefs = useRef([]);
  const [showOzelGirisModal, setShowOzelGirisModal] = useState(false);
  const [ozelGirisSifre, setOzelGirisSifre] = useState('');
  const [ozelGirisLoading, setOzelGirisLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.TELEFON);
        if (saved && saved.includes('@')) setEmail(saved);
      } catch (e) {}
    })();
    if (route?.params?.testAccount?.telefon && String(route.params.testAccount.telefon).includes('@')) {
      setEmail(route.params.testAccount.telefon || '');
    }
  }, [route]);

  const handleHesapLogin = async () => {
    const em = (email || '').trim().toLowerCase();
    if (!isValidEmail(em)) {
      Toast.show({ type: 'error', text1: 'E-posta', text2: 'Geçerli bir e-posta adresi giriniz.' });
      return;
    }
    const sifreTrim = (sifre || '').trim();
    if (!sifreTrim || sifreTrim.length < 6) {
      Toast.show({ type: 'error', text1: 'Şifre', text2: 'En az 6 karakter giriniz' });
      return;
    }
    setLoading(true);
    try {
      if (em) await AsyncStorage.setItem(STORAGE_KEYS.TELEFON, em);
      const result = await loginWithPassword(em, sifreTrim);
      setLoading(false);
      if (result?.success) Toast.show({ type: 'success', text1: 'Giriş başarılı' });
      else Toast.show({ type: 'error', text1: 'Giriş başarısız', text2: result?.message });
    } catch (e) {
      setLoading(false);
      setErrorDetails({ message: e?.message });
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || e?.message });
    }
  };

  const handleKodIleGiris = () => {
    if (!isValidEmail(email)) return;
    setKodModu(true);
    setOtpGonderildi(false);
    setOtp(['', '', '', '', '', '']);
  };

  const handleKodGonder = async () => {
    const em = (email || '').trim().toLowerCase();
    if (!isValidEmail(em) || !supabase) return;
    setSendCodeLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: em,
        options: { shouldCreateUser: false },
      });
      if (error) {
        console.warn('[Login] signInWithOtp error:', error.message, error.code, error.status);
        throw error;
      }
      setOtpGonderildi(true);
      Toast.show({ type: 'success', text1: 'Kod gönderildi', text2: `${em} adresine doğrulama kodu gönderildi` });
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Kod gönderilemedi',
        text2: getEmailOtpErrorMessage(e, { requiresExistingAccount: true }),
      });
    }
    setSendCodeLoading(false);
  };

  const handleOtpChange = (text, index) => {
    const digits = text.replace(/\D/g, '').split('');
    const next = [...otp];
    digits.forEach((d, i) => { if (index + i < 6) next[index + i] = d; });
    if (digits.length > 1) {
      const joined = next.join('');
      for (let j = 0; j < 6; j++) next[j] = joined[j] || '';
      otpRefs.current[5]?.focus();
    } else {
      next[index] = digits[0] || '';
      if (digits[0] && index < 5) otpRefs.current[index + 1]?.focus();
    }
    setOtp(next);
  };

  const handleOtpKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleKodDogrula = async () => {
    const code = otp.join('').replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      Toast.show({ type: 'error', text1: 'Kod', text2: '6 haneli kodu girin' });
      return;
    }
    const em = (email || '').trim().toLowerCase();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({ email: em, token: code, type: 'email' });
      if (error) throw error;
      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error('Oturum alınamadı');
      try {
        const sessionRes = await api.post('/auth/giris/otp-dogrula', { access_token: accessToken });
        const { token: t, kullanici: k, tesis: tesisData } = sessionRes.data || {};
        if (t && k && tesisData) {
          await loginWithToken(t, k, tesisData, accessToken);
        } else {
          await loginWithToken(accessToken, null, null, accessToken);
        }
        Toast.show({ type: 'success', text1: 'Giriş başarılı' });
      } catch (sessionErr) {
        const is429 = sessionErr?.response?.status === 429 || sessionErr?.response?.data?.rateLimit === true;
        await loginWithToken(accessToken, null, null, accessToken);
        Toast.show({
          type: 'success',
          text1: 'Giriş başarılı',
          text2: is429 ? 'Sunucu yoğundu; oturum açıldı.' : undefined,
        });
      }
    } catch (e) {
      const msg = e?.message || '';
      const isExpired = msg.toLowerCase().includes('expired') || e?.code === 'otp_expired';
      Toast.show({
        type: 'error',
        text1: isExpired ? 'Kodun süresi doldu' : 'Doğrulama başarısız',
        text2: isExpired ? 'Yeni kod gönderip tekrar deneyin.' : (msg || 'Kod hatalı.'),
      });
      setOtp(['', '', '', '', '', '']);
    }
    setLoading(false);
  };

  const kodModuKapat = () => {
    setKodModu(false);
    setOtpGonderildi(false);
    setOtp(['', '', '', '', '', '']);
  };

  const handleOzelGiris = async () => {
    const sifreTrim = (ozelGirisSifre || '').trim();
    if (!sifreTrim) {
      Toast.show({ type: 'error', text1: 'Giriş kodu', text2: 'Şifreyi girin' });
      return;
    }
    setOzelGirisLoading(true);
    try {
      const res = await api.post('/auth/ozel-giris', { sifre: sifreTrim });
      const { token: newToken, kullanici, tesis: tesisData } = res.data || {};
      if (newToken && kullanici && tesisData) {
        await loginWithToken(newToken, kullanici, tesisData, null);
        setShowOzelGirisModal(false);
        setOzelGirisSifre('');
        Toast.show({ type: 'success', text1: 'Giriş başarılı' });
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Toast.show({ type: 'error', text1: 'Giriş başarısız', text2: res.data?.message || 'Beklenmeyen yanıt' });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Özel giriş başarısız';
      Toast.show({ type: 'error', text1: 'Özel giriş', text2: msg });
    }
    setOzelGirisLoading(false);
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
          <Input
            label="E-posta"
            value={email}
            onChangeText={(t) => setEmail(t.trim())}
            placeholder=""
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!kodModu}
          />
          {kodModu ? (
            <>
              <TouchableOpacity onPress={kodModuKapat} style={styles.geriRow}>
                <Ionicons name="arrow-back" size={20} color={colors.primary} />
                <Text style={[styles.geriText, { color: colors.primary }]}>Geri</Text>
              </TouchableOpacity>
              {!otpGonderildi ? (
                <Button
                  variant="secondary"
                  onPress={handleKodGonder}
                  loading={sendCodeLoading}
                  disabled={sendCodeLoading}
                >
                  Kod Gönder
                </Button>
              ) : (
                <>
                  <Text style={[styles.kodAciklama, { color: colors.textSecondary }]}>
                    {email.trim().toLowerCase()} adresine gönderilen 6 haneli kodu girin
                  </Text>
                  <View style={styles.otpRow}>
                    {otp.map((digit, index) => (
                      <TextInput
                        key={index}
                        ref={(r) => (otpRefs.current[index] = r)}
                        style={[styles.otpInput, { borderColor: colors.border, color: colors.textPrimary }, digit && { borderColor: colors.primary }]}
                        value={digit}
                        onChangeText={(text) => handleOtpChange(text, index)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                        keyboardType="number-pad"
                        maxLength={index === 0 ? 6 : 1}
                        selectTextOnFocus
                        textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                      />
                    ))}
                  </View>
                  <Button
                    variant="primary"
                    onPress={handleKodDogrula}
                    loading={loading}
                    disabled={loading || otp.join('').length !== 6}
                  >
                    Doğrula
                  </Button>
                </>
              )}
            </>
          ) : (
            <>
              {isValidEmail(email) && (
                <>
                  <TouchableOpacity
                    style={[styles.kodGirisBtn, { borderColor: colors.primary }]}
                    onPress={handleKodIleGiris}
                    disabled={loading}
                  >
                    <Text style={[styles.kodGirisBtnText, { color: colors.primary }]}>Kod ile giriş</Text>
                  </TouchableOpacity>
                  <Text style={[styles.kodGirisHint, { color: colors.textSecondary }]}>
                    E-posta + şifre ile kayıt olduysanız kod gelmez; aşağıdaki şifre alanı ile giriş yapın.
                  </Text>
                </>
              )}
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
                  !(email || '').trim() ||
                  !(email || '').trim().includes('@') ||
                  !(sifre || '').trim() ||
                  (sifre || '').trim().length < 6
                }
              >
                Giriş Yap
              </Button>
            </>
          )}

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

          <View style={[styles.guestRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.guestText, { color: colors.textSecondary }]}>E-posta doğrulamadan denemek için</Text>
            <TouchableOpacity
              onPress={async () => {
                setGuestLoading(true);
                try {
                  const r = await loginAsGuest();
                  if (r?.success) Toast.show({ type: 'success', text1: 'Misafir girişi' });
                  else Toast.show({ type: 'error', text1: 'Hata', text2: r?.message });
                } finally {
                  setGuestLoading(false);
                }
              }}
              disabled={guestLoading}
              style={[styles.guestBtn, { borderColor: colors.primary }]}
            >
              <Text style={[styles.guestBtnText, { color: colors.primary }]}>{guestLoading ? 'Giriş yapılıyor...' : 'Misafir olarak devam et'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.guestRow, { borderTopColor: colors.border, marginTop: 0, paddingTop: spacing.md }]}>
            <TouchableOpacity
              onPress={() => { setShowOzelGirisModal(true); setOzelGirisSifre(''); }}
              style={[styles.guestBtn, { borderColor: colors.textSecondary }]}
            >
              <Text style={[styles.guestBtnText, { color: colors.textSecondary }]}>Şifre ile giriş</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.registerRow}>
            <Text style={[styles.registerText, { color: colors.textSecondary }]}>Hesabınız yok mu?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Kayit')}>
              <Text style={[styles.registerLink, { color: colors.primary }]}>Kayıt ol</Text>
            </TouchableOpacity>
          </View>

          {Platform.OS === 'android' && (needsPrivacyConsent || needsTermsConsent) ? (
            <TouchableOpacity
              style={[styles.consentBar, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
              onPress={() => navigation.navigate(needsPrivacyConsent ? 'PrivacyConsent' : 'TermsConsent')}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={[styles.consentBarText, { color: colors.primary }]}>
                Gizlilik politikası ve kullanım şartları
              </Text>
            </TouchableOpacity>
          ) : null}
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

      <Modal visible={showOzelGirisModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Giriş</Text>
              <TouchableOpacity onPress={() => { setShowOzelGirisModal(false); setOzelGirisSifre(''); }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Input
              label=""
              value={ozelGirisSifre}
              onChangeText={setOzelGirisSifre}
              placeholder="Şifre"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              variant="primary"
              onPress={handleOzelGiris}
              loading={ozelGirisLoading}
              disabled={ozelGirisLoading || !(ozelGirisSifre || '').trim()}
            >
              Giriş Yap
            </Button>
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
    paddingTop: (spacing['4xl'] ?? 56) + 8,
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
  kodGirisBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  kodGirisBtnText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: '600',
  },
  kodGirisHint: {
    fontSize: typography.text.caption?.fontSize || 12,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  geriRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  geriText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  kodAciklama: {
    fontSize: typography.text.body.fontSize,
    marginBottom: spacing.md,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
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
  guestRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  guestText: { fontSize: typography.text.caption.fontSize, marginBottom: spacing.sm },
  guestBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  guestBtnText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  registerText: { fontSize: typography.text.body.fontSize },
  registerLink: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  consentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: spacing.lg,
  },
  consentBarText: { fontSize: 14, fontWeight: '600' },
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
