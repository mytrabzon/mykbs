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

const APP_PREFIX = 'mykbs';
const STORAGE_KEYS = { TELEFON: `@${APP_PREFIX}:login:telefon` };
const SUPPORT_EMAIL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com';
const SUPPORT_PHONE = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE || '0850 304 5061';
const SUPPORT_PHONE_TEL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE_TEL || 'tel:08503045061';

const isValidEmail = (v) => (v || '').trim().length >= 5 && (v || '').trim().includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || '').trim());

export default function LoginScreen({ route }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { loginWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

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
    const em = (email || '').trim().toLowerCase();
    if (!isValidEmail(em)) return;
    navigation.navigate('OTPVerify', { islemTipi: 'giris', email: em });
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
          />
          {isValidEmail(email) && (
            <TouchableOpacity
              style={[styles.kodGirisBtn, { borderColor: colors.primary }]}
              onPress={handleKodIleGiris}
              disabled={loading}
            >
              <Text style={[styles.kodGirisBtnText, { color: colors.primary }]}>Kod ile giriş</Text>
            </TouchableOpacity>
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
