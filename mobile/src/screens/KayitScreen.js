/**
 * Yeni kayıt ekranı (e-posta ile).
 * Ad soyad, e-posta, şifre, otel adı, oda sayısı, ortalama bildirim. Telefon isteğe bağlı olarak profilde eklenebilir.
 * Kayıt sonrası kullanıcı uygulamayı kullanabilir; KBS için Ayarlar'dan tesis kodu ve şifre ile onaya gönderir.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { SegmentedControl, Button, Input } from '../components/ui';
import { typography, spacing } from '../theme';

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((e || '').trim());

export default function KayitScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { loginWithToken } = useAuth();

  const [adSoyad, setAdSoyad] = useState('');
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [tesisAdi, setTesisAdi] = useState('');
  const [odaSayisi, setOdaSayisi] = useState('10');
  const [ortalamaBildirim, setOrtalamaBildirim] = useState('100');
  const [loading, setLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifiedFor, setEmailVerifiedFor] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);

  const normalizedEmail = useMemo(() => (email || '').trim().toLowerCase(), [email]);
  const isCurrentEmailVerified = emailVerified && emailVerifiedFor === normalizedEmail;

  const handleKayit = async () => {
    const ad = (adSoyad || '').trim();
    if (ad.length < 2) {
      Toast.show({ type: 'error', text1: 'Ad Soyad', text2: 'En az 2 karakter girin' });
      return;
    }
    const em = normalizedEmail;
    if (!em || !isValidEmail(em)) {
      Toast.show({ type: 'error', text1: 'E-posta', text2: 'Geçerli bir e-posta girin' });
      return;
    }
    if (!isCurrentEmailVerified) {
      Toast.show({ type: 'error', text1: 'E-posta doğrulanmadı', text2: 'Devam etmek için önce e-posta adresinizi doğrulayın' });
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
    const tesis = (tesisAdi || '').trim();
    if (tesis.length < 2) {
      Toast.show({ type: 'error', text1: 'Otel adı', text2: 'Otel / tesis adı girin' });
      return;
    }
    const oda = parseInt(odaSayisi, 10);
    if (isNaN(oda) || oda < 1 || oda > 10000) {
      Toast.show({ type: 'error', text1: 'Oda sayısı', text2: '1–10000 arası girin' });
      return;
    }
    const bildirim = parseInt(ortalamaBildirim, 10) || 100;

    setLoading(true);
    try {
      const res = await api.post('/auth/kayit', {
        adSoyad: ad,
        email: em,
        sifre,
        sifreTekrar,
        tesisAdi: tesis,
        odaSayisi: oda,
        ortalamaBildirim: bildirim,
      });
      const { token, kullanici, tesis: tesisData } = res.data || {};
      if (token && kullanici && tesisData) {
        await loginWithToken(token, kullanici, tesisData);
        Toast.show({ type: 'success', text1: 'Kayıt tamamlandı', text2: 'Uygulamayı kullanabilirsiniz.' });
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: res.data?.message || 'Kayıt tamamlanamadı' });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Kayıt başarısız';
      Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const odaNum = parseInt(odaSayisi, 10) || 0;
  const valid =
    adSoyad.trim().length >= 2 &&
    isValidEmail(email) &&
    isCurrentEmailVerified &&
    sifre.length >= 6 &&
    sifre === sifreTekrar &&
    tesisAdi.trim().length >= 2 &&
    !isNaN(odaNum) && odaNum >= 1 && odaNum <= 10000;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.primary} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: colors.primary }]}>
          <View style={[styles.logoWrap, { backgroundColor: colors.surface }]}>
            <MaterialIcons name="hotel" size={36} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Kayıt Ol</Text>
          <Text style={styles.heroSub}>Ad soyad, e-posta, şifre ve otel bilgilerinizi girin</Text>
        </View>

        <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
          <Input
            label="Ad Soyad"
            value={adSoyad}
            onChangeText={setAdSoyad}
            placeholder="Adınız ve soyadınız"
            autoCapitalize="words"
          />
          <Input
            label="E-posta"
            value={email}
            onChangeText={(t) => {
              const next = t.trim();
              setEmail(next);
              if (emailVerifiedFor !== next.toLowerCase()) {
                setEmailVerified(false);
              }
            }}
            placeholder="ornek@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {isValidEmail(normalizedEmail) ? (
            <>
              <TouchableOpacity
                style={[
                  styles.emailVerifyBtn,
                  { borderColor: colors.primary, backgroundColor: isCurrentEmailVerified ? `${colors.primary}15` : 'transparent' },
                ]}
                onPress={() =>
                  navigation.navigate('OTPVerify', {
                    email: normalizedEmail,
                    islemTipi: 'kayit_email',
                    onSuccess: () => {
                      setEmailVerified(true);
                      setEmailVerifiedFor(normalizedEmail);
                      Toast.show({ type: 'success', text1: 'E-posta doğrulandı', text2: 'Kayıt işlemini tamamlayabilirsiniz.' });
                    },
                  })
                }
              >
                <Ionicons
                  name={isCurrentEmailVerified ? 'checkmark-circle' : 'mail-open-outline'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={[styles.emailVerifyBtnText, { color: colors.primary }]}>
                  {isCurrentEmailVerified ? 'E-posta doğrulandı' : 'Maili doğrula'}
                </Text>
              </TouchableOpacity>
              {!isCurrentEmailVerified ? (
                <Text style={[styles.verifyHint, { color: colors.textSecondary }]}>
                  Kayıt olmadan önce bu e-posta adresine gelen 6 haneli kodu doğrulayın.
                </Text>
              ) : null}
            </>
          ) : null}
          <Input
            label="Şifre (en az 6 karakter)"
            value={sifre}
            onChangeText={setSifre}
            placeholder="Şifre"
            secureTextEntry={!showPassword}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            }
          />
          <Input
            label="Şifre tekrar"
            value={sifreTekrar}
            onChangeText={setSifreTekrar}
            placeholder="Şifreyi tekrar girin"
            secureTextEntry={!showPasswordRepeat}
            rightIcon={
              <TouchableOpacity onPress={() => setShowPasswordRepeat(!showPasswordRepeat)}>
                <Ionicons name={showPasswordRepeat ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            }
          />
          <Input
            label="Otel / Tesis adı"
            value={tesisAdi}
            onChangeText={setTesisAdi}
            placeholder="Örn. Örnek Otel"
          />
          <Input
            label="Oda sayısı"
            value={odaSayisi}
            onChangeText={(t) => setOdaSayisi(t.replace(/\D/g, '').slice(0, 5) || '')}
            placeholder="Örn. 20"
            keyboardType="number-pad"
          />
          <Input
            label="Ortalama bildirim (aylık tahmini)"
            value={ortalamaBildirim}
            onChangeText={(t) => setOrtalamaBildirim(t.replace(/\D/g, '').slice(0, 5) || '')}
            placeholder="Örn. 100"
            keyboardType="number-pad"
          />

          <Button
            variant="primary"
            onPress={handleKayit}
            loading={loading}
            disabled={loading || !valid}
            style={styles.submitBtn}
          >
            Kayıt Ol
          </Button>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Kayıt sonrası uygulamanın tüm özelliklerini kullanabilirsiniz. KBS (Kimlik Bildirim Sistemi) için Ayarlar bölümünden tesis kodu ve şifrenizi girip onaya göndermeniz yeterlidir.
          </Text>

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.loginLinkText, { color: colors.primary }]}>Zaten hesabınız var mı? Giriş yapın</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
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
  heroSub: {
    fontSize: typography.text.caption.fontSize,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
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
  submitBtn: { marginTop: spacing.lg },
  emailVerifyBtn: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emailVerifyBtnText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
  verifyHint: {
    fontSize: typography.text.caption.fontSize,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: typography.text.caption.fontSize,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  loginLink: { marginTop: spacing.xl, alignItems: 'center' },
  loginLinkText: { fontSize: typography.text.body.fontSize, fontWeight: '600' },
};
