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

export default function OTPVerifyScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loginWithToken } = useAuth();
  const { telefon, islemTipi, onSuccess } = route.params || {};
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 dakika
  const inputRefs = useRef([]);
  const usedSupabaseForOtp = useRef(false);

  useEffect(() => {
    logger.log('OTPVerifyScreen mounted', { telefon, islemTipi });

    // SMS ile girişte: Önce Supabase ile gönder. Sadece Supabase başarılı olursa doğrulamayı da Supabase ile yap; yoksa API.
    if (telefon && telefon.length >= 10 && islemTipi === 'giris') {
      if (supabase) {
        const phone = formatPhoneForSupabase(telefon);
        supabase.auth.signInWithOtp({ phone })
          .then(({ error }) => {
            if (error) {
              usedSupabaseForOtp.current = false;
              logger.log('Supabase OTP failed, falling back to API', { message: error.message });
              return api.post('/auth/giris/otp-iste', { telefon }).then((res) => {
                Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: 'Doğrulama kodunu girin.' });
                if (__DEV__ && res?.data?.otpForDev) {
                  setOtp(res.data.otpForDev.split(''));
                  Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${res.data.otpForDev}` });
                }
              }).catch((e) => {
                logger.error('API OTP request failed', e);
                Toast.show({ type: 'error', text1: 'SMS gönderilemedi', text2: e?.response?.data?.message || e?.message || 'Tekrar deneyin.' });
              });
            }
            usedSupabaseForOtp.current = true;
            Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: 'Doğrulama kodunu girin.' });
          })
          .catch((e) => {
            logger.error('Supabase signInWithOtp failed, trying API', e);
            usedSupabaseForOtp.current = false;
            api.post('/auth/giris/otp-iste', { telefon })
              .then((res) => {
                Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: 'Doğrulama kodunu girin.' });
                if (__DEV__ && res?.data?.otpForDev) {
                  setOtp(res.data.otpForDev.split(''));
                  Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${res.data.otpForDev}` });
                }
              })
              .catch((err) => {
                Toast.show({ type: 'error', text1: 'SMS gönderilemedi', text2: err?.response?.data?.message || err?.message || 'Tekrar deneyin.' });
              });
          });
      } else {
        usedSupabaseForOtp.current = false;
        api.post('/auth/giris/otp-iste', { telefon })
          .then((res) => {
            Toast.show({ type: 'success', text1: 'SMS gönderildi', text2: 'Doğrulama kodunu girin.' });
            if (__DEV__ && res?.data?.otpForDev) {
              setOtp(res.data.otpForDev.split(''));
              Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${res.data.otpForDev}` });
            }
          })
          .catch((e) => {
            Toast.show({ type: 'error', text1: 'SMS gönderilemedi', text2: e?.response?.data?.message || e?.message || 'Tekrar deneyin.' });
          });
      }
    }

    // Countdown başlat
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      logger.log('OTPVerifyScreen unmounted');
    };
  }, []);

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
            try {
              const response = await api.post('/auth/supabase-phone-session', { access_token: accessToken });
              const { token, kullanici, tesis, supabaseAccessToken } = response.data;
              setLoading(false);
              if (onSuccess) onSuccess({ token, kullanici, tesis });
              else {
                await loginWithToken(token, kullanici, tesis, supabaseAccessToken);
              }
              return;
            } catch (sessionErr) {
              setLoading(false);
              try {
                const response = await api.post('/auth/giris/otp-dogrula', { telefon, otp: code });
                const { token, kullanici, tesis } = response.data;
                await loginWithToken(token, kullanici, tesis);
                return;
              } catch (_) {
                throw sessionErr;
              }
            }
          }
        }
        const response = await api.post('/auth/giris/otp-dogrula', { telefon, otp: code });
        const { token, kullanici, tesis } = response.data;
        setLoading(false);
        if (onSuccess) onSuccess({ token, kullanici, tesis });
        else {
          await loginWithToken(token, kullanici, tesis);
        }
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
      const text2 = isNetwork
        ? 'İnternet bağlantınızı kontrol edip tekrar deneyin.'
        : (apiMessage || error.message || 'Kod hatalı veya süresi doldu. Yeni kod gönderip tekrar deneyin.');
      Toast.show({
        type: 'error',
        text1: isNetwork ? 'Bağlantı Hatası' : 'Doğrulama Başarısız',
        text2,
      });
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    try {
      logger.button('Resend OTP Button', 'clicked');
      setLoading(true);
      let devOtpFilled = false;

      if (islemTipi === 'kayit') {
        logger.api('POST', '/auth/kayit/otp-iste', { telefon });
        const response = await api.post('/auth/kayit/otp-iste', {
          telefon,
          islemTipi: 'kayit'
        });
        Toast.show({
          type: 'success',
          text1: 'SMS Gönderildi',
          text2: 'Yeni doğrulama kodu telefonunuza gönderildi'
        });
        setCountdown(300);
        if (__DEV__ && response?.data?.otpForDev) {
          setOtp(response.data.otpForDev.split(''));
          Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${response.data.otpForDev}` });
          devOtpFilled = true;
        }
      } else {
        if (supabase && usedSupabaseForOtp.current) {
          const phone = formatPhoneForSupabase(telefon);
          const { error } = await supabase.auth.signInWithOtp({ phone });
          if (error) {
            usedSupabaseForOtp.current = false;
            const res = await api.post('/auth/giris/otp-iste', { telefon });
            if (__DEV__ && res?.data?.otpForDev) {
              setOtp(res.data.otpForDev.split(''));
              Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${res.data.otpForDev}` });
              devOtpFilled = true;
            }
          }
          Toast.show({ type: 'success', text1: 'SMS Gönderildi', text2: 'Yeni doğrulama kodu telefonunuza gönderildi' });
          setCountdown(300);
        } else {
          const res = await api.post('/auth/giris/otp-iste', { telefon });
          Toast.show({ type: 'success', text1: 'SMS Gönderildi', text2: 'Yeni doğrulama kodu telefonunuza gönderildi' });
          setCountdown(300);
          if (__DEV__ && res?.data?.otpForDev) {
            setOtp(res.data.otpForDev.split(''));
            Toast.show({ type: 'info', text1: 'Test modu', text2: `Kod otomatik dolduruldu: ${res.data.otpForDev}` });
            devOtpFilled = true;
          }
        }
      }

      setLoading(false);
      if (!devOtpFilled) {
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      logger.error('Resend OTP error', error);
      setLoading(false);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: error.response?.data?.message || 'SMS gönderilemedi'
      });
    }
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
        <Text style={styles.title}>Doğrulama Kodu</Text>
        <Text style={styles.subtitle}>
          {telefon} numaralı telefona gönderilen 6 haneli kodu giriniz
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

