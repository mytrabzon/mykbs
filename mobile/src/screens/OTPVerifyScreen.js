import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../services/api';
import { supabase } from '../lib/supabase/supabase';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { useAuth } from '../context/AuthContext';

function formatPhoneForSupabase(telefon) {
  if (!telefon) return '';
  let p = String(telefon).trim().replace(/\D/g, '');
  if (p.startsWith('0')) p = p.slice(1);
  if (!p.startsWith('90')) p = '90' + p;
  return '+' + p.slice(0, 12);
}

const formatPhoneDisplay = (t) => {
  if (!t) return '';
  const d = String(t).replace(/\D/g, '');
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0, 3) + ' ' + d.slice(3);
  return d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6, 10);
};

export default function OTPVerifyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loginWithToken } = useAuth();
  const { telefon: paramTelefon, islemTipi, onSuccess } = route.params || {};
  const [phoneInput, setPhoneInput] = useState(paramTelefon || '');
  const [otpSent, setOtpSent] = useState(false);
  const [sentToPhone, setSentToPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);
  const usedSupabaseForOtp = useRef(false);

  const telefon = otpSent ? sentToPhone : (phoneInput.trim().replace(/\D/g, '').length >= 10 ? phoneInput.trim() : paramTelefon || '');

  useEffect(() => {
    logger.log('OTPVerifyScreen mounted', { paramTelefon, islemTipi });
  }, []);

  const handleSendOtp = async () => {
    const raw = phoneInput.replace(/\D/g, '');
    if (raw.length < 10) {
      Toast.show({ type: 'error', text1: 'Geçersiz numara', text2: '10 haneli telefon numaranızı girin' });
      return;
    }
    setLoading(true);
    try {
      const num = raw.length >= 10 ? raw : phoneInput.trim();
      if (islemTipi === 'kayit') {
        if (supabase) {
          const phone = formatPhoneForSupabase(num);
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (error) throw error;
          usedSupabaseForOtp.current = true;
        } else {
          await api.post('/auth/kayit/otp-iste', { telefon: num });
        }
      } else {
        if (supabase) {
          const phone = formatPhoneForSupabase(num);
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (error) {
            usedSupabaseForOtp.current = false;
            await api.post('/auth/giris/otp-iste', { telefon: num });
          } else {
            usedSupabaseForOtp.current = true;
          }
        } else {
          await api.post('/auth/giris/otp-iste', { telefon: num });
        }
      }
      setOtpSent(true);
      setSentToPhone(phoneInput.trim());
      setCountdown(300);
      Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: `${formatPhoneDisplay(num)} numarasına kod gönderildi` });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'SMS gönderilemedi', text2: e?.response?.data?.message || e?.message || 'Tekrar deneyin.' });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleOtpChange = (text, index) => {
    logger.log('OTP input changed', { index, text });
    // Klavyeden "Kod" önerisine tıklanınca veya yapıştırınca tüm kod gelir
    const digits = text.replace(/\D/g, '');
    if (digits.length >= 6) {
      const code = digits.slice(0, 6).split('');
      setOtp(code);
      handleVerify(code.join(''));
      return;
    }
    if (text.length > 1) {
      text = text[text.length - 1];
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode = null) => {
    try {
      const code = otpCode || otp.join('');
      logger.button('Verify OTP Button', 'clicked');
      logger.log('OTP verification started', { telefon, otpLength: code.length, islemTipi });

      if (code.length !== 6) {
        logger.warn('OTP validation failed - invalid length');
        Toast.show({
          type: 'error',
          text1: 'Geçersiz Kod',
          text2: 'Lütfen 6 haneli kodu giriniz'
        });
        return;
      }

      setLoading(true);

      if (islemTipi === 'kayit') {
        // Kayıt tamamlama
        logger.api('POST', '/auth/kayit/dogrula', { telefon, otpLength: code.length });
        const response = await api.post('/auth/kayit/dogrula', {
          telefon,
          otp: code,
          ...route.params?.kayitBilgileri || {}
        });

        logger.api('POST', '/auth/kayit/dogrula', null, {
          status: response.status,
          hasToken: !!response.data.token
        });

        const { token, kullanici, tesis } = response.data;

        logger.log('Registration successful', { kullaniciId: kullanici.id, tesisId: tesis.id });

        if (onSuccess) {
          onSuccess({ token, kullanici, tesis });
        } else {
          await loginWithToken(token, kullanici, tesis);
        }
      } else {
        // Giriş: Önce Supabase ile dene (SMS Supabase'den geldiyse). Hata alırsan API ile dene.
        const phone = formatPhoneForSupabase(telefon);
        if (supabase) {
          const { data, error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
          if (!error && data?.session?.access_token) {
            const accessToken = data.session.access_token;
            if (onSuccess) {
              onSuccess({ token: accessToken, kullanici: null, tesis: null });
              setLoading(false);
              return;
            }
            // access_token ile auth_verify_otp çağır: profil/tesis yoksa oluşturur, kullanici/tesis döner (ilerleme için gerekli)
            try {
              const sessionRes = await api.post('/auth/giris/otp-dogrula', { access_token: accessToken });
              const { token: t, kullanici: k, tesis: tesisData } = sessionRes.data || {};
              if (t && k && tesisData) {
                await loginWithToken(t, k, tesisData, accessToken);
              } else {
                await loginWithToken(accessToken, null, null, accessToken);
              }
            } catch (sessionErr) {
              const status = sessionErr?.response?.status;
              const msg = sessionErr?.response?.data?.message || sessionErr?.message;
              logger.error('OTP session bootstrap error', { status, message: msg });
              if (status === 503 && (msg || '').includes('Veritabanı')) {
                Toast.show({ type: 'error', text1: 'Bakım', text2: msg || 'Veritabanı güncellemesi gerekli. Lütfen yöneticiye bildirin.' });
                setLoading(false);
                return;
              }
              await loginWithToken(accessToken, null, null, accessToken);
            } finally {
              setLoading(false);
            }
            return;
          }
          if (error) {
            const isExpired = error?.message?.toLowerCase?.().includes('expired') ||
              error?.message?.toLowerCase?.().includes('otp_expired') ||
              error?.status === 403;
            setLoading(false);
            Toast.show({
              type: 'error',
              text1: isExpired ? 'Kodun süresi doldu' : 'Doğrulama Başarısız',
              text2: isExpired
                ? "Doğrulama kodunun süresi doldu. 'Yeni kod gönder' ile tekrar kod isteyin."
                : (error?.message || 'Kod hatalı. Yeni kod gönderip tekrar deneyin.'),
            });
            setOtp(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
            return;
          }
        }
        const response = await api.post('/auth/giris/otp-dogrula', { telefon, otp: code });
        const { token, kullanici, tesis } = response.data;
        try {
          if (onSuccess) onSuccess({ token, kullanici, tesis });
          else await loginWithToken(token, kullanici, tesis);
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(false);
    } catch (error) {
      logger.error('OTP verification error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setLoading(false);
      const apiMessage = error.response?.data?.message || error.response?.data?.error;
      const isNetwork = error.message === 'Network Error' || error.code === 'NETWORK_ERROR';
      const isTimeout = error.name === 'AbortError' || error.message?.includes('abort');
      const text2 = isTimeout
        ? 'İstek zaman aşımına uğradı. İnterneti kontrol edip tekrar deneyin.'
        : isNetwork
          ? 'İnternet bağlantınızı kontrol edip tekrar deneyin.'
          : (apiMessage || error.message || 'Kod hatalı veya süresi doldu. Yeni kod gönderip tekrar deneyin.');
      Toast.show({
        type: 'error',
        text1: isTimeout ? 'Zaman Aşımı' : isNetwork ? 'Bağlantı Hatası' : 'Doğrulama Başarısız',
        text2,
      });
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    const num = telefon || phoneInput.trim().replace(/\D/g, '');
    if (!num || num.replace(/\D/g, '').length < 10) {
      Toast.show({ type: 'error', text1: 'Numara gerekli', text2: 'Önce telefon numaranızı girin' });
      return;
    }
    try {
      setLoading(true);
      if (islemTipi === 'kayit') {
        if (supabase) {
          const { error } = await supabase.auth.signInWithOtp({ phone: formatPhoneForSupabase(num) });
          if (error) throw error;
        } else {
          await api.post('/auth/kayit/otp-iste', { telefon: num });
        }
      } else {
        if (supabase) {
          const { error } = await supabase.auth.signInWithOtp({ phone: formatPhoneForSupabase(num) });
          if (error) {
            usedSupabaseForOtp.current = false;
            await api.post('/auth/giris/otp-iste', { telefon: num });
          }
        } else {
          await api.post('/auth/giris/otp-iste', { telefon: num });
        }
      }
      setCountdown(300);
      Toast.show({ type: 'success', text1: 'SMS Gönderildi', text2: `${formatPhoneDisplay(num)} numarasına yeni kod gönderildi` });
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Hata', text2: error?.response?.data?.message || error?.message || 'SMS gönderilemedi' });
    }
    setLoading(false);
  };

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>
          {otpSent ? 'Doğrulama Kodu' : 'Telefon Numaranız'}
        </Text>
        {!otpSent ? (
          <>
            <Text style={styles.subtitle}>
              Kod alacağınız 10 haneli telefon numaranızı girin
            </Text>
            <TextInput
              style={styles.phoneInput}
              value={phoneInput}
              onChangeText={(t) => setPhoneInput(t.replace(/[^\d\s]/g, '').slice(0, 14))}
              placeholder="5xx xxx xx xx"
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, (loading || phoneInput.replace(/\D/g, '').length < 10) && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading || phoneInput.replace(/\D/g, '').length < 10}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Gönderiliyor...' : 'Kod Gönder'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {formatPhoneDisplay(sentToPhone)} numarasına gönderilen 6 haneli kodu giriniz
            </Text>

            <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.otpInput, digit && styles.otpInputFilled]}
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

        {countdown > 0 ? (
          <Text style={styles.countdown}>
            Kod {formatCountdown(countdown)} saniye içinde sona erecek
          </Text>
        ) : (
          <Text style={styles.countdownExpired}>
            Kod süresi doldu. Yeni kod gönderin.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || otp.join('').length !== 6}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, countdown > 0 && styles.resendButtonDisabled]}
          onPress={handleResend}
          disabled={loading || countdown > 0}
        >
          <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
            Yeni Kod Gönder {countdown > 0 && `(${formatCountdown(countdown)})`}
          </Text>
        </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#007AFF'
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666'
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  otpInput: {
    width: 50,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold'
  },
  otpInputFilled: {
    borderColor: '#007AFF'
  },
  phoneInput: {
    height: 50,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center'
  },
  countdown: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    fontSize: 14
  },
  countdownExpired: {
    textAlign: 'center',
    color: '#ff3b30',
    marginBottom: 20,
    fontSize: 14,
    fontWeight: '600'
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  resendButton: {
    marginTop: 20,
    alignItems: 'center'
  },
  resendButtonDisabled: {
    opacity: 0.5
  },
  resendText: {
    color: '#007AFF',
    fontSize: 14
  },
  resendTextDisabled: {
    color: '#999'
  }
});

