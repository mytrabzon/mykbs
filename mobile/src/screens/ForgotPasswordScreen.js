import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase/supabase';
import { Button, Input } from '../components/ui';
import { typography, spacing } from '../theme';
import { getEmailOtpErrorMessage } from '../utils/authErrorMessage';

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

export default function ForgotPasswordScreen({ route }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { resetPasswordForEmail: sendResetLink, clearRecoveryPending } = useAuth();
  const fromRecoveryLink = route?.params?.fromRecoveryLink === true;
  const [step, setStep] = useState(fromRecoveryLink ? 'sifre' : 'email'); // 'email' | 'otp' | 'sifre'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [useEmailOtp, setUseEmailOtp] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (fromRecoveryLink) setStep('sifre');
  }, [fromRecoveryLink]);

  const handleSendOtp = async () => {
    if (!email.trim() || !isValidEmail(email)) {
      Toast.show({ type: 'error', text1: 'Geçersiz e-posta', text2: 'Geçerli bir e-posta adresi girin' });
      return;
    }
    setLoading(true);
    setUseEmailOtp(false);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { shouldCreateUser: false },
        });
        if (!error) {
          setUseEmailOtp(true);
          Toast.show({ type: 'success', text1: 'Kod gönderildi', text2: 'E-postanıza gelen 6 haneli kodu girin.' });
          setStep('otp');
          setLoading(false);
          return;
        }
        console.warn('[ForgotPassword] signInWithOtp error:', error.message, error.code, error.status);
        Toast.show({
          type: 'error',
          text1: 'Hata',
          text2: getEmailOtpErrorMessage(error, { requiresExistingAccount: true }),
        });
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: 'Şifre sıfırlama servisi kullanılamıyor' });
      }
    } catch (e) {
      console.warn('[ForgotPassword] signInWithOtp exception:', e?.message);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: getEmailOtpErrorMessage(e, { requiresExistingAccount: true }),
      });
    }
    setLoading(false);
  };

  const handleOtpChange = (text, index) => {
    const digits = text.replace(/\D/g, '').split('');
    const next = [...otp];
    digits.forEach((d, i) => {
      if (index + i < 6) next[index + i] = d;
    });
    if (digits.length > 1) {
      const joined = next.join('');
      for (let j = 0; j < 6; j++) next[j] = joined[j] || '';
      inputRefs.current[5]?.focus();
    } else {
      next[index] = digits[0] || '';
      if (digits[0] && index < 5) inputRefs.current[index + 1]?.focus();
    }
    setOtp(next);
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join('').replace(/\D/g, '').slice(0, 6);
    if (code.length !== 6) {
      Toast.show({ type: 'error', text1: 'Kod', text2: '6 haneli kodu girin' });
      return;
    }
    setLoading(true);
    try {
      if (useEmailOtp && supabase) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code,
          type: 'email',
        });
        if (error) {
          Toast.show({ type: 'error', text1: 'Doğrulama başarısız', text2: error.message });
          setLoading(false);
          return;
        }
        setSupabaseSession(data?.session);
        setStep('sifre');
        Toast.show({ type: 'success', text1: 'Doğrulandı', text2: 'Yeni şifrenizi belirleyin' });
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: 'Önce e-postanıza kod gönderin.' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'Kod doğrulanamadı' });
    }
    setLoading(false);
  };

  const handleSetPassword = async () => {
    if (yeniSifre.length < 6) {
      Toast.show({ type: 'error', text1: 'Şifre', text2: 'En az 6 karakter girin' });
      return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
      Toast.show({ type: 'error', text1: 'Şifreler eşleşmiyor', text2: 'Aynı şifreyi iki kez girin' });
      return;
    }
    if (fromRecoveryLink) {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          Toast.show({ type: 'error', text1: 'Oturum sonlandı', text2: 'Linki tekrar deneyin veya Kod Gönder ile sıfırlayın.' });
          setLoading(false);
          if (clearRecoveryPending) clearRecoveryPending();
          navigation.replace('Login');
          return;
        }
        const { error } = await supabase.auth.updateUser({ password: yeniSifre });
        if (error) throw error;
        await supabase.auth.signOut();
        if (clearRecoveryPending) clearRecoveryPending();
        Toast.show({ type: 'success', text1: 'Şifre güncellendi', text2: 'Yeni şifrenizle giriş yapabilirsiniz.' });
        navigation.replace('Login');
      } catch (e) {
        const msg = e?.message || e?.response?.data?.message || 'Tekrar deneyin';
        Toast.show({ type: 'error', text1: 'Güncellenemedi', text2: msg });
      }
      setLoading(false);
      return;
    }

    if (!supabaseSession?.access_token) {
      Toast.show({ type: 'error', text1: 'Oturum sonlandı', text2: 'Baştan başlayıp tekrar kod isteyin' });
      setStep('email');
      setSupabaseSession(null);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: yeniSifre });
      if (error) throw error;
      await supabase.auth.signOut();
      Toast.show({ type: 'success', text1: 'Şifre güncellendi', text2: 'Yeni şifrenizle giriş yapabilirsiniz.' });
      navigation.replace('Login');
    } catch (e) {
      const msg = e?.message || e?.response?.data?.message || 'Tekrar deneyin';
      Toast.show({ type: 'error', text1: 'Güncellenemedi', text2: msg });
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => {
            if (fromRecoveryLink) {
              if (clearRecoveryPending) clearRecoveryPending();
              supabase?.auth?.signOut().catch(() => {});
              navigation.replace('Login');
            } else {
              step === 'email' ? navigation.goBack() : setStep(step === 'sifre' ? 'otp' : 'email');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Geri</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.textPrimary }]}>{fromRecoveryLink ? 'Yeni şifre belirleyin' : 'Şifremi Unuttum'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === 'email' && 'Kayıtlı e-posta adresinizi girin. Size doğrulama kodu veya link göndereceğiz.'}
          {step === 'otp' && `${email} adresine gönderilen 6 haneli kodu girin.`}
          {(step === 'sifre' || fromRecoveryLink) && 'Yeni şifrenizi belirleyin (en az 6 karakter).'}
        </Text>

        {step === 'email' && !fromRecoveryLink && (
          <>
            <Input
              label="E-posta"
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <Button
              variant="primary"
              onPress={handleSendOtp}
              loading={loading}
              disabled={loading || !email.trim() || !isValidEmail(email)}
            >
              Kod Gönder
            </Button>
            {email.trim() && isValidEmail(email) && (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={async () => {
                  const res = await sendResetLink(email);
                  if (res.success) {
                    Toast.show({ type: 'success', text1: 'Link gönderildi', text2: res.message });
                  } else {
                    Toast.show({ type: 'error', text1: 'Hata', text2: res.message });
                  }
                }}
              >
                <Text style={[styles.linkText, { color: colors.primary }]}>E-postanıza şifre sıfırlama linki gönder</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step === 'otp' && (
          <>
            <View style={styles.otpRow}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
                  style={[styles.otpInput, { borderColor: colors.border, color: colors.textPrimary }, digit && { borderColor: colors.primary }]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? 6 : 1}
                  selectTextOnFocus
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                />
              ))}
            </View>
            <Button variant="primary" onPress={handleVerifyOtp} loading={loading} disabled={loading || otp.join('').length !== 6}>
              Doğrula
            </Button>
          </>
        )}

        {step === 'sifre' && (
          <>
            <Input
              label="Yeni şifre"
              value={yeniSifre}
              onChangeText={setYeniSifre}
              placeholder=""
              secureTextEntry={!showPassword}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              }
            />
            <Input
              label="Yeni şifre (tekrar)"
              value={yeniSifreTekrar}
              onChangeText={setYeniSifreTekrar}
              placeholder=""
              secureTextEntry={!showPassword}
            />
            <Button
              variant="primary"
              onPress={handleSetPassword}
              loading={loading}
              disabled={loading || yeniSifre.length < 6 || yeniSifre !== yeniSifreTekrar}
            >
              Şifreyi Güncelle
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing['3xl'] },
  backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, gap: spacing.xs },
  backText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  title: { fontSize: typography.text.h1.fontSize, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.text.body.fontSize, marginBottom: spacing.xl },
  linkRow: { alignItems: 'center', marginTop: spacing.lg },
  linkText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
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
});
