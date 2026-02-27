import React, { useState, useRef } from 'react';
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
import { supabase } from '../lib/supabase/supabase';
import { getApiBaseUrl } from '../config/api';
import { Button, Input } from '../components/ui';
import { typography, spacing } from '../theme';

function formatPhoneForSupabase(telefon) {
  if (!telefon) return '';
  let p = String(telefon).trim().replace(/\D/g, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (!p.startsWith('90')) p = '90' + p;
  return '+' + p.slice(0, 12);
}

const formatPhone = (t) => t.replace(/[^\d]/g, '').slice(0, 10);

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [step, setStep] = useState('telefon'); // 'telefon' | 'otp' | 'sifre'
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [yeniSifre, setYeniSifre] = useState('');
  const [yeniSifreTekrar, setYeniSifreTekrar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseSession, setSupabaseSession] = useState(null);
  const [useBackendOtp, setUseBackendOtp] = useState(false);
  const inputRefs = useRef([]);

  const handleSendOtp = async () => {
    const raw = telefon.trim().replace(/\D/g, '');
    if (raw.length < 10) {
      Toast.show({ type: 'error', text1: 'Geçersiz telefon', text2: '10 haneli telefon giriniz' });
      return;
    }
    setLoading(true);
    setUseBackendOtp(false);
    try {
      const backendUrl = getApiBaseUrl();

      // Önce Supabase dene
      if (supabase) {
        const phone = formatPhoneForSupabase(telefon);
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (!error) {
          Toast.show({ type: 'success', text1: 'Kod gönderildi', text2: 'Telefonunuza gelen 6 haneli kodu girin.' });
          setStep('otp');
          setLoading(false);
          return;
        }
      }

      // Supabase yoksa veya hata verirse backend dene
      if (backendUrl) {
        const res = await fetch(`${backendUrl}/api/auth/sifre-sifirla/otp-iste`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telefon: raw }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setUseBackendOtp(true);
          Toast.show({
            type: 'success',
            text1: 'Kod gönderildi',
            text2: data.otpForDev ? `Test kodu: ${data.otpForDev}` : 'Telefonunuza gelen 6 haneli kodu girin.',
          });
          setStep('otp');
          setLoading(false);
          return;
        }
        throw new Error(data.message || 'Kod gönderilemedi');
      }

      Toast.show({ type: 'error', text1: 'Hata', text2: supabase ? 'Kod gönderilemedi' : 'Kod servisi kullanılamıyor' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'Kod gönderilemedi' });
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
    const code = otp.join('');
    if (code.length !== 6) {
      Toast.show({ type: 'error', text1: 'Kod', text2: '6 haneli kodu girin' });
      return;
    }
    setLoading(true);
    try {
      if (useBackendOtp) {
        // Backend akışı: OTP'yi sifre adımında göndereceğiz
        setSupabaseSession({ otp: code });
        setStep('sifre');
        Toast.show({ type: 'success', text1: 'Doğrulandı', text2: 'Yeni şifrenizi belirleyin' });
      } else {
        const phone = formatPhoneForSupabase(telefon);
        const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
        if (error) {
          Toast.show({ type: 'error', text1: 'Doğrulama başarısız', text2: error.message });
          setLoading(false);
          return;
        }
        setSupabaseSession(data?.session);
        setStep('sifre');
        Toast.show({ type: 'success', text1: 'Doğrulandı', text2: 'Yeni şifrenizi belirleyin' });
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
    if (useBackendOtp && supabaseSession?.otp) {
      const backendUrl = getApiBaseUrl();
      if (!backendUrl) {
        Toast.show({ type: 'error', text1: 'Hata', text2: 'Sunucu adresi bulunamadı' });
        return;
      }
      setLoading(true);
      try {
        const raw = telefon.trim().replace(/\D/g, '');
        const res = await fetch(`${backendUrl}/api/auth/sifre-sifirla`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telefon: raw,
            otp: supabaseSession.otp,
            yeniSifre,
            yeniSifreTekrar,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          Toast.show({ type: 'success', text1: 'Şifre güncellendi', text2: 'Yeni şifrenizle giriş yapabilirsiniz.' });
          navigation.replace('Login');
        } else {
          throw new Error(data.message || 'Şifre güncellenemedi');
        }
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Güncellenemedi', text2: e?.message || 'Tekrar deneyin' });
      }
      setLoading(false);
      return;
    }

    if (!supabaseSession?.access_token) {
      Toast.show({ type: 'error', text1: 'Oturum sonlandı', text2: 'Baştan başlayıp tekrar kod isteyin' });
      setStep('telefon');
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
        <TouchableOpacity style={styles.backRow} onPress={() => (step === 'telefon' ? navigation.goBack() : setStep(step === 'sifre' ? 'otp' : 'telefon'))}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Geri</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.textPrimary }]}>Şifremi Unuttum</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {step === 'telefon' && 'Kayıtlı telefon numaranızı girin. Size doğrulama kodu göndereceğiz.'}
          {step === 'otp' && `${telefon} numarasına gönderilen 6 haneli kodu girin.`}
          {step === 'sifre' && 'Yeni şifrenizi belirleyin (en az 6 karakter).'}
        </Text>

        {step === 'telefon' && (
          <>
            <Input
              label="Telefon"
              value={telefon}
              onChangeText={(t) => setTelefon(formatPhone(t))}
              placeholder=""
              keyboardType="phone-pad"
              autoFocus
            />
            <Button variant="primary" onPress={handleSendOtp} loading={loading} disabled={loading || telefon.replace(/\D/g, '').length < 10}>
              Kod Gönder
            </Button>
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
