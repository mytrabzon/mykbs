/**
 * Profil: Telefon ve E-posta bağlama / değiştirme
 * - E-posta ile giren kullanıcı telefonunu bağlayabilir; telefon ile giren e-postasını bağlayabilir.
 * - Mevcut telefon veya e-posta değiştirilebilir.
 * - Yeni değer girilir → koda gönderilir → profil ekranında açılan kod yazma bölümüne girilip onaylanır.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase/supabase';
import { getApiBaseUrl, isSupabaseConfigured } from '../config/api';
import { backendHealth } from '../services/backendHealth';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { Button, Input } from '../components/ui';
import { typography, spacing } from '../theme';

function formatPhoneForSupabase(telefon) {
  if (!telefon) return '';
  let p = String(telefon).trim().replace(/\D/g, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (!p.startsWith('90')) p = '90' + p;
  return '+' + p.slice(0, 12);
}

const isEmail = (v) => (v || '').trim().includes('@');

const SEND_CODE_TIMEOUT_MS = 15000;
function withTimeout(promise, ms, msg = 'İstek zaman aşımına uğradı') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

export default function ProfilIletisimScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user, tesis, refreshMe } = useAuth();

  const currentEmail = (user?.email || '').trim() || null;
  const currentPhone = (user?.telefon || user?.phone || '').trim() || null;

  const [step, setStep] = useState('list'); // 'list' | 'enter_email' | 'enter_phone' | 'enter_code'
  const [target, setTarget] = useState(null); // 'email' | 'phone'
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const inputRefs = useRef([]);
  const [backendStatus, setBackendStatus] = useState({ configured: false, isOnline: null, error: null });
  const [supabaseStatus, setSupabaseStatus] = useState({ configured: false, isOnline: null, error: null });

  useEffect(() => {
    const backendUrl = getApiBaseUrl();
    const supabaseCfg = isSupabaseConfigured();
    setBackendStatus((prev) => ({ ...prev, configured: !!backendUrl }));
    setSupabaseStatus((prev) => ({ ...prev, configured: supabaseCfg }));
    const updateBackend = (status) => setBackendStatus({ configured: !!backendUrl, isOnline: status.isOnline, error: status.error });
    const updateSupabase = (status) => setSupabaseStatus({ configured: status.configured, isOnline: status.isOnline, error: status.error });
    backendHealth.checkHealth().then(updateBackend);
    if (supabaseCfg) backendHealth.checkSupabaseHealth().then(updateSupabase);
    const unsubBackend = backendHealth.onStatusChange(updateBackend);
    const unsubSupabase = backendHealth.onSupabaseStatusChange(updateSupabase);
    return () => {
      if (typeof unsubBackend === 'function') unsubBackend();
      if (typeof unsubSupabase === 'function') unsubSupabase();
    };
  }, []);

  const pendingEmail = step === 'enter_code' && target === 'email' ? newEmail : null;
  const pendingPhone = step === 'enter_code' && target === 'phone' ? newPhone : null;

  const sendCodeToEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.show({ type: 'error', text1: 'Geçersiz e-posta', text2: 'Geçerli bir e-posta adresi girin' });
      return;
    }
    if (!supabase) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'E-posta servisi kullanılamıyor.' });
      return;
    }
    setSendingCode(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ email }),
        SEND_CODE_TIMEOUT_MS,
        'E-posta gönderimi zaman aşımına uğradı. İnterneti kontrol edip tekrar deneyin.'
      );
      if (error) throw error;
      setStep('list');
      setTarget(null);
      setNewEmail('');
      Toast.show({
        type: 'success',
        text1: 'Doğrulama linki gönderildi',
        text2: `${email} adresine doğrulama linki gönderildi. E-postanızı (ve gerekiyorsa spam klasörünü) kontrol edin.`,
        visibilityTime: 5000,
      });
    } catch (e) {
      const msg = e?.message || 'Tekrar deneyin.';
      const hint =
        msg.includes('authorized') || msg.includes('Email address not authorized')
          ? 'Supabase Dashboard → Custom SMTP yapılandırın veya adresi ekleyin.'
          : msg.includes('rate') || msg.includes('limit')
            ? 'E-posta limiti aşıldı; biraz sonra tekrar deneyin.'
            : msg.includes('smtp') || msg.includes('SMTP')
              ? 'Supabase Dashboard → Auth → SMTP ayarlarını kontrol edin.'
              : null;
      Toast.show({
        type: 'error',
        text1: 'E-posta gönderilemedi',
        text2: hint ? `${msg} ${hint}` : msg,
        visibilityTime: 6000,
      });
    } finally {
      setSendingCode(false);
    }
  };

  const sendCodeToPhone = async () => {
    const raw = newPhone.trim().replace(/\D/g, '');
    if (raw.length < 10) {
      Toast.show({ type: 'error', text1: 'Geçersiz telefon', text2: 'En az 10 haneli numara girin' });
      return;
    }
    const phone = formatPhoneForSupabase(newPhone);
    if (!supabase) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'SMS servisi kullanılamıyor.' });
      return;
    }
    setSendingCode(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.updateUser({ phone }),
        SEND_CODE_TIMEOUT_MS,
        'SMS gönderimi zaman aşımına uğradı. İnterneti kontrol edip tekrar deneyin.'
      );
      if (error) throw error;
      setStep('enter_code');
      setTarget('phone');
      setCode(['', '', '', '', '', '']);
      Toast.show({ type: 'success', text1: 'Kod gönderildi', text2: 'Telefonunuza gelen 6 haneli kodu girin' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kod gönderilemedi', text2: e?.message || 'Tekrar deneyin.' });
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    const token = code.join('');
    if (token.length !== 6) {
      Toast.show({ type: 'error', text1: 'Kod eksik', text2: '6 haneli kodu girin' });
      return;
    }
    setLoading(true);
    try {
      if (target === 'email' && pendingEmail) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: pendingEmail,
          token,
          type: 'email_change',
        });
        if (error) throw error;
        if (data?.user) {
          await refreshMe?.();
          Toast.show({ type: 'success', text1: 'E-posta güncellendi', text2: 'Yeni e-posta adresiniz kaydedildi.' });
          setStep('list');
          setTarget(null);
          setNewEmail('');
          setCode(['', '', '', '', '', '']);
        }
      } else if (target === 'phone' && pendingPhone) {
        const phone = formatPhoneForSupabase(pendingPhone);
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'phone_change',
        });
        if (error) throw error;
        if (data?.user) {
          await refreshMe?.();
          Toast.show({ type: 'success', text1: 'Telefon güncellendi', text2: 'Yeni telefon numaranız kaydedildi.' });
          setStep('list');
          setTarget(null);
          setNewPhone('');
          setCode(['', '', '', '', '', '']);
        }
      }
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      const isExpired = msg.includes('expired') || msg.includes('süresi');
      Toast.show({
        type: 'error',
        text1: isExpired ? 'Kodun süresi doldu' : 'Doğrulama başarısız',
        text2: isExpired ? 'Yeni kod isteyip tekrar deneyin.' : (e?.message || 'Kod hatalı.'),
      });
    } finally {
      setLoading(false);
    }
  };

  const startLinkOrChange = (type) => {
    setTarget(type);
    if (type === 'email') {
      setNewEmail(currentEmail || '');
      setStep('enter_email');
    } else {
      setNewPhone(currentPhone ? currentPhone.replace(/\D/g, '').replace(/^90/, '0') : '');
      setStep('enter_phone');
    }
  };

  const cancelFlow = () => {
    setStep('list');
    setTarget(null);
    setNewEmail('');
    setNewPhone('');
    setCode(['', '', '', '', '', '']);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Telefon ve E-posta"
        tesis={tesis}
        onBack={() => (step !== 'list' ? cancelFlow() : navigation.goBack())}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('Ayarlar')}
        backendConfigured={backendStatus.configured}
        backendOnline={backendStatus.isOnline}
        backendError={backendStatus.error}
        supabaseConfigured={supabaseStatus.configured}
        supabaseOnline={supabaseStatus.isOnline}
        supabaseError={supabaseStatus.error}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Mevcut durum */}
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Mevcut bilgiler</Text>
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Ionicons name="mail-outline" size={22} color={colors.textSecondary} />
              <Text style={[styles.value, { color: colors.textPrimary }]}>{currentEmail || '— Bağlı değil'}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0, borderBottomColor: colors.border }]}>
              <Ionicons name="call-outline" size={22} color={colors.textSecondary} />
              <Text style={[styles.value, { color: colors.textPrimary }]}>{currentPhone || '— Bağlı değil'}</Text>
            </View>
          </View>

          {step === 'list' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bağla veya değiştir</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                E-posta veya telefon ekleyebilir, mevcut olanı doğrulama kodu ile değiştirebilirsiniz.
              </Text>
              <Button
                variant="secondary"
                onPress={() => startLinkOrChange('email')}
                style={styles.actionBtn}
              >
                {currentEmail ? 'E-posta değiştir' : 'E-posta bağla'}
              </Button>
              <Button
                variant="secondary"
                onPress={() => startLinkOrChange('phone')}
                style={styles.actionBtn}
              >
                {currentPhone ? 'Telefon değiştir' : 'Telefon bağla'}
              </Button>
            </View>
          )}

          {(step === 'enter_email' || step === 'enter_phone') && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {target === 'email' ? (currentEmail ? 'Yeni e-posta' : 'E-posta ekle') : currentPhone ? 'Yeni telefon' : 'Telefon ekle'}
              </Text>
              {target === 'email' ? (
                <>
                  <Input
                    label="E-posta adresi"
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="ornek@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    Doğrulama linki bu adrese gönderilir. Linke tıklayarak e-postanızı bağlayın.
                  </Text>
                  <View style={styles.rowButtons}>
                    <Button variant="secondary" onPress={cancelFlow}>İptal</Button>
                    <Button variant="primary" onPress={sendCodeToEmail} loading={sendingCode} disabled={sendingCode}>
                      Kod gönder
                    </Button>
                  </View>
                </>
              ) : (
                <>
                  <Input
                    label="Telefon numarası"
                    value={newPhone}
                    onChangeText={setNewPhone}
                    placeholder="5XX XXX XX XX"
                    keyboardType="phone-pad"
                  />
                  <View style={styles.rowButtons}>
                    <Button variant="secondary" onPress={cancelFlow}>İptal</Button>
                    <Button variant="primary" onPress={sendCodeToPhone} loading={sendingCode} disabled={sendingCode}>
                      Kod gönder
                    </Button>
                  </View>
                </>
              )}
            </View>
          )}

          {step === 'enter_code' && (
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Doğrulama kodu</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {target === 'email'
                  ? `${pendingEmail} adresine gönderilen 6 haneli kodu girin.`
                  : 'Telefonunuza gelen 6 haneli kodu girin.'}
              </Text>
              <View style={styles.otpRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <TextInput
                    key={i}
                    ref={(r) => (inputRefs.current[i] = r)}
                    style={[
                      styles.otpInput,
                      { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    value={code[i]}
                    onChangeText={(t) => {
                      const digit = t.replace(/\D/g, '').slice(-1);
                      const next = [...code];
                      next[i] = digit;
                      setCode(next);
                      if (digit && i < 5) inputRefs.current[i + 1]?.focus();
                    }}
                    onKeyPress={({ nativeEvent }) => {
                      if (nativeEvent.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus();
                    }}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                ))}
              </View>
              <View style={styles.rowButtons}>
                <Button variant="secondary" onPress={cancelFlow}>İptal</Button>
                <Button variant="primary" onPress={verifyCode} loading={loading} disabled={loading || code.join('').length !== 6}>
                  Onayla
                </Button>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.screenPadding, paddingBottom: 80 },
  section: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.text.h2.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  value: { fontSize: typography.text.body.fontSize, flex: 1 },
  hint: { fontSize: typography.text.body.fontSize, marginBottom: spacing.md },
  actionBtn: { marginBottom: spacing.sm },
  rowButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, justifyContent: 'flex-end' },
  otpRow: { flexDirection: 'row', gap: 8, marginVertical: spacing.md, justifyContent: 'center' },
  otpInput: {
    width: 44,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
  },
});
