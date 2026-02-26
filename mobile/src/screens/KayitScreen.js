import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api, getBackendUrl } from '../services/api';
import { supabase } from '../lib/supabase/supabase';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';

const { colors, typography, spacing } = theme;

function formatPhoneForSupabase(telefon) {
  if (!telefon) return '';
  let p = String(telefon).trim().replace(/\D/g, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (!p.startsWith('90')) p = '90' + p;
  return '+' + p.slice(0, 12);
}

export default function KayitScreen() {
  const navigation = useNavigation();
  const { loginWithToken } = useAuth();
  const usedSupabaseForKayit = useRef(false);
  /** OTP isteğinde Supabase'e gönderilen telefon (verify'da birebir aynı kullanılmalı) */
  const lastSupabasePhoneRef = useRef(null);

  const [step, setStep] = useState(1);
  const [telefon, setTelefon] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [adSoyad, setAdSoyad] = useState('');
  const [email, setEmail] = useState('');
  const [tesisAdi, setTesisAdi] = useState('');
  const [il, setIl] = useState('İstanbul');
  const [ilce, setIlce] = useState('');
  const [adres, setAdres] = useState('');
  const [odaSayisi, setOdaSayisi] = useState('10');
  const [tesisTuru, setTesisTuru] = useState('otel');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpInputRefs = useRef([]);

  const formatPhoneNumber = (text) => {
    const numbers = text.replace(/[^\d]/g, '');
    if (numbers.length <= 10) return numbers;
    return numbers.substring(0, 10);
  };

  const handleOtpRequest = async () => {
    if (!telefon || telefon.length < 10) {
      Toast.show({ type: 'error', text1: 'Geçersiz Telefon', text2: '10 haneli telefon giriniz' });
      return;
    }
    try {
      setLoading(true);
      const phone = formatPhoneForSupabase(telefon);
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({ phone });
        if (!error) {
          usedSupabaseForKayit.current = true;
          lastSupabasePhoneRef.current = phone;
          Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: 'Doğrulama kodunu girin.' });
          setStep(2);
          setCountdown(300);
          setLoading(false);
          return;
        }
        logger.log('Kayıt: Supabase OTP fallback', { message: error.message });
      }
      usedSupabaseForKayit.current = false;
      const { data } = await api.post('/auth/kayit/otp-iste', { telefon });
      Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: 'Doğrulama kodunu girin.' });
      setStep(2);
      setCountdown(300);
      if (__DEV__ && data?.otpForDev) {
        setOtp(data.otpForDev.split(''));
        Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${data.otpForDev}` });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: error.response?.data?.message || 'SMS gönderilemedi.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text, index) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 6) {
      const code = digits.slice(0, 6).split('');
      setOtp(code);
      otpInputRefs.current[5]?.focus();
      return;
    }
    const ch = digits.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = ch;
    setOtp(newOtp);
    if (ch && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const canGoStep3 = otp.every((d) => d !== '') && otp.join('').length === 6;

  const goToStep3 = () => {
    if (!canGoStep3) {
      Toast.show({ type: 'error', text1: 'Kod', text2: '6 haneli kodu girin' });
      return;
    }
    setStep(3);
  };

  const handleKayit = async () => {
    if (!adSoyad || adSoyad.trim().length < 3) {
      Toast.show({ type: 'error', text1: 'Ad Soyad', text2: 'En az 3 karakter girin' });
      return;
    }
    if (!sifre || sifre.length < 6) {
      Toast.show({ type: 'error', text1: 'Şifre', text2: 'En az 6 karakter olmalı' });
      return;
    }
    if (sifre !== sifreTekrar) {
      Toast.show({ type: 'error', text1: 'Şifreler eşleşmiyor', text2: 'Aynı şifreyi iki kez girin' });
      return;
    }
    if (email && !email.includes('@')) {
      Toast.show({ type: 'error', text1: 'E-posta', text2: 'Geçerli bir e-posta girin' });
      return;
    }

    try {
      setLoading(true);
      if (usedSupabaseForKayit.current) {
        const phone = lastSupabasePhoneRef.current || formatPhoneForSupabase(telefon);
        let accessToken = null;
        const backendUrl = typeof getBackendUrl === 'function' ? getBackendUrl() : null;
        if (backendUrl) {
          try {
            const verifyRes = await api.post('/auth/kayit/supabase-verify-otp', { phone, token: otp.join('') });
            accessToken = verifyRes.data?.access_token || null;
          } catch (verifyErr) {
            const msg = verifyErr.response?.data?.message || verifyErr.message || 'Doğrulama başarısız.';
            const isExpired = msg.toLowerCase().includes('süresi doldu') || msg.toLowerCase().includes('expired');
            Toast.show({
              type: 'error',
              text1: isExpired ? 'Kodun süresi doldu' : 'Kod geçersiz',
              text2: isExpired ? "'Yeni kod gönder' ile tekrar kod isteyin." : msg,
            });
            setLoading(false);
            return;
          }
        }
        if (!accessToken && supabase) {
          const { data: supabaseData, error: verifyError } = await supabase.auth.verifyOtp({
            phone,
            token: otp.join(''),
            type: 'sms',
          });
          if (verifyError || !supabaseData?.session?.access_token) {
            const isExpired = verifyError?.message?.toLowerCase?.().includes('expired') ||
              verifyError?.message?.toLowerCase?.().includes('otp_expired') ||
              verifyError?.status === 403 ||
              verifyError?.code === 'otp_expired';
            Toast.show({
              type: 'error',
              text1: isExpired ? 'Kodun süresi doldu' : 'Kod geçersiz',
              text2: isExpired
                ? "'Yeni kod gönder' ile tekrar kod isteyin."
                : (verifyError?.message || 'Doğrulama başarısız. Yeni kod isteyip tekrar deneyin.'),
            });
            setLoading(false);
            return;
          }
          accessToken = supabaseData.session.access_token;
        }
        if (!accessToken) {
          Toast.show({ type: 'error', text1: 'Doğrulama başarısız', text2: 'Sunucu adresi eksik veya doğrulama yapılamadı.' });
          setLoading(false);
          return;
        }
        const response = await api.post('/auth/kayit/supabase-create', {
          access_token: accessToken,
          adSoyad: adSoyad.trim(),
          email: email || null,
          tesisAdi: tesisAdi || adSoyad.trim() + ' Tesis',
          il: il || 'İstanbul',
          ilce: ilce || '',
          adres: adres || '',
          odaSayisi: odaSayisi || '10',
          tesisTuru: tesisTuru || 'otel',
          sifre,
          sifreTekrar,
        });
        const { token, kullanici, tesis, supabaseAccessToken } = response.data;
        await loginWithToken(token, kullanici, tesis, supabaseAccessToken);
      } else {
        const response = await api.post('/auth/kayit/dogrula', {
          telefon,
          otp: otp.join(''),
          sifre,
          sifreTekrar,
          adSoyad: adSoyad.trim(),
          email: email || null,
          tesisAdi: tesisAdi || adSoyad.trim() + ' Tesis',
          il: il || 'İstanbul',
          ilce: ilce || '',
          adres: adres || '',
          odaSayisi: odaSayisi || '10',
          tesisTuru: tesisTuru || 'otel',
        });
        const { token, kullanici, tesis } = response.data;
        await loginWithToken(token, kullanici, tesis);
      }
      Toast.show({ type: 'success', text1: 'Kayıt tamamlandı', text2: 'Hesabınız oluşturuldu.' });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Kayıt başarısız',
        text2: error.response?.data?.message || 'Tekrar deneyin.'
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (step !== 2 || countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => (c <= 0 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [step, countdown]);

  const progress = (step / 3) * 100;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => (step > 1 ? setStep(step - 1) : navigation.goBack())}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.stepLabel}>
          Adım {step} / 3
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Adım 1: Telefon */}
        {step === 1 && (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="phone-android" size={40} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Telefon numaranız</Text>
            <Text style={styles.cardSubtitle}>
              Doğrulama kodu göndereceğiz. 10 haneli numarayı girin.
            </Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="5xx xxx xx xx"
                placeholderTextColor={colors.textDisabled}
                value={telefon}
                onChangeText={(text) => setTelefon(formatPhoneNumber(text))}
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, (loading || telefon.length < 10) && styles.primaryBtnDisabled]}
              onPress={handleOtpRequest}
              disabled={loading || telefon.length < 10}
            >
              {loading ? (
                <Text style={styles.primaryBtnText}>Gönderiliyor...</Text>
              ) : (
                <>
                  <Ionicons name="chatbubble-outline" size={22} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Doğrulama kodu gönder</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Adım 2: OTP */}
        {step === 2 && (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="sms" size={40} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Doğrulama kodu</Text>
            <Text style={styles.cardSubtitle}>
              {telefon} numarasına gönderilen 6 haneli kodu girin.
            </Text>
            <View style={styles.otpRow}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <TextInput
                  key={i}
                  ref={(r) => (otpInputRefs.current[i] = r)}
                  style={styles.otpBox}
                  value={otp[i]}
                  onChangeText={(t) => handleOtpChange(t, i)}
                  onKeyPress={(e) => handleOtpKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={6}
                  selectTextOnFocus
                />
              ))}
            </View>
            {countdown > 0 && (
              <Text style={styles.countdownText}>
                Yeni kod için {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, !canGoStep3 && styles.primaryBtnDisabled]}
              onPress={goToStep3}
              disabled={!canGoStep3}
            >
              <Text style={styles.primaryBtnText}>Doğrula ve devam et</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Adım 3: Şifre + bilgiler */}
        {step === 3 && (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <MaterialIcons name="lock" size={40} color={colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Şifre ve bilgiler</Text>
            <Text style={styles.cardSubtitle}>
              Şifrenizi iki kez girin ve yetkili bilgilerini doldurun.
            </Text>

            <Text style={styles.fieldLabel}>Şifre *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="En az 6 karakter"
                placeholderTextColor={colors.textDisabled}
                value={sifre}
                onChangeText={setSifre}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Şifre tekrar *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Şifrenizi tekrar girin"
                placeholderTextColor={colors.textDisabled}
                value={sifreTekrar}
                onChangeText={setSifreTekrar}
                secureTextEntry={!showPasswordRepeat}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPasswordRepeat(!showPasswordRepeat)} style={styles.eyeBtn}>
                <Ionicons name={showPasswordRepeat ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Ad Soyad *</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Örn: Ahmet Yılmaz"
                placeholderTextColor={colors.textDisabled}
                value={adSoyad}
                onChangeText={setAdSoyad}
                autoCapitalize="words"
              />
            </View>

            <Text style={styles.fieldLabel}>E-posta (opsiyonel)</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="ornek@email.com"
                placeholderTextColor={colors.textDisabled}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.fieldLabel}>Tesis adı (opsiyonel)</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="business-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Örn: Grand Otel"
                placeholderTextColor={colors.textDisabled}
                value={tesisAdi}
                onChangeText={setTesisAdi}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading ||
                  adSoyad.trim().length < 3 ||
                  sifre.length < 6 ||
                  sifre !== sifreTekrar) &&
                  styles.primaryBtnDisabled,
              ]}
              onPress={handleKayit}
              disabled={
                loading ||
                adSoyad.trim().length < 3 ||
                sifre.length < 6 ||
                sifre !== sifreTekrar
              }
            >
              {loading ? (
                <Text style={styles.primaryBtnText}>Kayıt yapılıyor...</Text>
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={22} color={colors.white} />
                  <Text style={styles.primaryBtnText}>Kayıt ol</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLinkText}>Zaten hesabınız var mı? Giriş yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.screenPadding,
    paddingBottom: spacing['4xl'],
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.base,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: spacing.borderRadius.xl,
    borderBottomRightRadius: spacing.borderRadius.xl,
    ...spacing.shadow.base,
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: spacing.sm,
    marginBottom: spacing.base,
  },
  progressWrap: {
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  stepLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadius.xl,
    padding: spacing.xl,
    marginTop: spacing.xl,
    ...spacing.shadow.lg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.base,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: spacing.borderRadius.base,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
  },
  eyeBtn: {
    padding: spacing.sm,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.borderRadius.base,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  countdownText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: spacing.borderRadius.base,
    paddingVertical: spacing.base,
    gap: spacing.sm,
    minHeight: 52,
    marginTop: spacing.base,
    ...spacing.shadow.base,
  },
  primaryBtnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  loginLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: typography.fontWeight.medium,
  },
});
