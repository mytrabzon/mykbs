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
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const APP_PREFIX = 'mykbs';
const STORAGE_KEYS = {
  TELEFON: `@${APP_PREFIX}:login:telefon`
};

export default function LoginScreen({ route }) {
  const navigation = useNavigation();
  const { loginWithPassword } = useAuth();
  const [telefon, setTelefon] = useState('');
  const [sifre, setSifre] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [loginMode, setLoginMode] = useState('sms'); // 'sms' | 'password'
  const [showPassword, setShowPassword] = useState(false);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSavedCredentials();
    if (route?.params?.testAccount?.telefon) {
      setTelefon(route.params.testAccount.telefon || '');
    }
    logger.log('LoginScreen mounted');

    Animated.sequence([
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    return () => logger.log('LoginScreen unmounted');
  }, [route]);

  const loadSavedCredentials = async () => {
    try {
      const savedTelefon = await AsyncStorage.getItem(STORAGE_KEYS.TELEFON);
      if (savedTelefon) setTelefon(savedTelefon);
    } catch (error) {
      logger.error('Error loading saved credentials', error);
    }
  };

  const saveCredentials = async () => {
    try {
      if (telefon) await AsyncStorage.setItem(STORAGE_KEYS.TELEFON, telefon);
    } catch (error) {
      logger.error('Error saving credentials', error);
    }
  };

  const formatPhoneNumber = (text) => {
    const numbers = text.replace(/[^\d]/g, '');
    if (numbers.length <= 10) return numbers;
    return numbers.substring(0, 10);
  };

  const handleSmsLogin = async () => {
    try {
      logger.button('SMS Giriş', 'clicked');
      if (!telefon || telefon.length < 10) {
        Toast.show({
          type: 'error',
          text1: 'Geçersiz Telefon',
          text2: 'Lütfen geçerli bir telefon numarası giriniz (10 haneli)'
        });
        return;
      }
      await saveCredentials();
      navigation.navigate('OTPVerify', { telefon, islemTipi: 'giris' });
    } catch (error) {
      logger.error('SMS login nav error', error);
      setErrorDetails({ message: error.message, timestamp: new Date().toISOString() });
      Toast.show({ type: 'error', text1: 'Hata', text2: error.message });
    }
  };

  const handlePasswordLogin = async () => {
    try {
      logger.button('Şifre ile Giriş', 'clicked');
      if (!telefon || telefon.length < 10) {
        Toast.show({ type: 'error', text1: 'Geçersiz Telefon', text2: '10 haneli telefon giriniz' });
        return;
      }
      if (!sifre || sifre.length < 6) {
        Toast.show({ type: 'error', text1: 'Şifre', text2: 'En az 6 karakter giriniz' });
        return;
      }
      setLoading(true);
      await saveCredentials();
      const result = await loginWithPassword(telefon, sifre);
      setLoading(false);
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Giriş başarılı' });
      } else {
        Toast.show({ type: 'error', text1: 'Giriş başarısız', text2: result.message });
      }
    } catch (error) {
      setLoading(false);
      setErrorDetails({ message: error.message, timestamp: new Date().toISOString() });
      Toast.show({ type: 'error', text1: 'Hata', text2: error.response?.data?.message || error.message });
    }
  };

  const handleKayit = () => {
    logger.button('Kayıt Button', 'clicked');
    navigation.navigate('Kayit');
  };

  const logoTranslateY = logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });
  const logoOpacity = logoAnim;
  const titleTranslateY = titleAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
  const titleOpacity = titleAnim;
  const formOpacity = formAnim;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.primary} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Lobi / Hero – logo ve KBS biraz aşağıda, animasyonlu */}
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Animated.View
              style={[
                styles.logoWrap,
                {
                  opacity: logoOpacity,
                  transform: [{ translateY: logoTranslateY }],
                },
              ]}
            >
              <MaterialIcons name="hotel" size={36} color={theme.colors.primary} />
            </Animated.View>
            <Animated.Text
              style={[
                styles.heroTitle,
                {
                  opacity: titleOpacity,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              MyKBS
            </Animated.Text>
            <Animated.Text style={[styles.heroTagline, { opacity: titleOpacity }]}>
              Otel Kimlik Bildirim Otomasyonu
            </Animated.Text>
            <Animated.Text style={[styles.heroWelcome, { opacity: titleOpacity }]}>
              Hoş geldiniz
            </Animated.Text>
          </View>
        </View>

        <Animated.View style={[styles.formWrapper, { opacity: formOpacity }]}>
          <View style={styles.formCard}>
            {/* Giriş türü seçimi */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, loginMode === 'sms' && styles.toggleBtnActive]}
                onPress={() => setLoginMode('sms')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={loginMode === 'sms' ? theme.colors.white : theme.colors.textSecondary}
                />
                <Text style={[styles.toggleText, loginMode === 'sms' && styles.toggleTextActive]}>
                  SMS ile
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, loginMode === 'password' && styles.toggleBtnActive]}
                onPress={() => setLoginMode('password')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={loginMode === 'password' ? theme.colors.white : theme.colors.textSecondary}
                />
                <Text style={[styles.toggleText, loginMode === 'password' && styles.toggleTextActive]}>
                  Şifre ile
                </Text>
              </TouchableOpacity>
            </View>

            {loginMode === 'sms' ? (
              <>
                <Text style={styles.formSubtitle}>
                  Telefon numaranıza gönderilen kodu girin
                </Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="5xx xxx xx xx"
                    placeholderTextColor={theme.colors.textDisabled}
                    value={telefon}
                    onChangeText={(text) => setTelefon(formatPhoneNumber(text))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (loading || telefon.length < 10) && styles.primaryButtonDisabled
                  ]}
                  onPress={handleSmsLogin}
                  disabled={loading || telefon.length < 10}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <Text style={styles.primaryButtonText}>Yönlendiriliyor...</Text>
                  ) : (
                    <>
                      <Ionicons name="chatbubble-outline" size={22} color={theme.colors.white} />
                      <Text style={styles.primaryButtonText}>SMS ile Giriş Yap</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.formSubtitle}>
                  Telefon ve şifrenizle giriş yapın
                </Text>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="call-outline" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="5xx xxx xx xx"
                    placeholderTextColor={theme.colors.textDisabled}
                    value={telefon}
                    onChangeText={(text) => setTelefon(formatPhoneNumber(text))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                <View style={styles.inputWrap}>
                  <View style={styles.inputIconWrap}>
                    <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textSecondary} />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Şifre"
                    placeholderTextColor={theme.colors.textDisabled}
                    value={sifre}
                    onChangeText={setSifre}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={theme.colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    (loading || telefon.length < 10 || !sifre) && styles.primaryButtonDisabled
                  ]}
                  onPress={handlePasswordLogin}
                  disabled={loading || telefon.length < 10 || !sifre}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <Text style={styles.primaryButtonText}>Giriş yapılıyor...</Text>
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={22} color={theme.colors.white} />
                      <Text style={styles.primaryButtonText}>Giriş Yap</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {errorDetails && (
              <TouchableOpacity
                style={styles.errorDetailsButton}
                onPress={() => setShowErrorModal(true)}
              >
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.error} />
                <Text style={styles.errorDetailsButtonText}>Hata detayları</Text>
              </TouchableOpacity>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Hesabınız yok mu?</Text>
              <TouchableOpacity onPress={handleKayit} activeOpacity={0.7}>
                <Text style={styles.registerLink}>Kayıt ol</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Hata Detayları</Text>
              <TouchableOpacity
                onPress={() => setShowErrorModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {errorDetails && (
                <>
                  <View style={styles.errorSection}>
                    <Text style={styles.errorLabel}>Hata Mesajı:</Text>
                    <Text style={styles.errorValue}>{errorDetails.message || 'Bilinmeyen hata'}</Text>
                  </View>
                  {errorDetails.status && (
                    <View style={styles.errorSection}>
                      <Text style={styles.errorLabel}>HTTP Durum Kodu:</Text>
                      <Text style={styles.errorValue}>{errorDetails.status}</Text>
                    </View>
                  )}
                  {errorDetails.response && (
                    <View style={styles.errorSection}>
                      <Text style={styles.errorLabel}>Sunucu Yanıtı:</Text>
                      <Text style={styles.errorValue}>
                        {JSON.stringify(errorDetails.response, null, 2)}
                      </Text>
                    </View>
                  )}
                  {errorDetails.timestamp && (
                    <View style={styles.errorSection}>
                      <Text style={styles.errorLabel}>Zaman:</Text>
                      <Text style={styles.errorValue}>
                        {new Date(errorDetails.timestamp).toLocaleString('tr-TR')}
                      </Text>
                    </View>
                  )}
                  {errorDetails.stack && (
                    <View style={styles.errorSection}>
                      <Text style={styles.errorLabel}>Stack Trace:</Text>
                      <Text style={styles.errorStack}>{errorDetails.stack}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowErrorModal(false)}
              >
                <Text style={styles.modalButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const { colors, typography, spacing } = theme;
const heroRadius = 28;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing['3xl'],
  },
  hero: {
    backgroundColor: colors.primary,
    paddingTop: spacing['4xl'] + 8,
    paddingBottom: spacing['2xl'] + 24,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: heroRadius,
    borderBottomRightRadius: heroRadius,
    ...spacing.shadow.lg,
  },
  heroInner: {
    alignItems: 'center',
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.base,
    ...spacing.shadow.md,
  },
  heroTitle: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  heroTagline: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroWelcome: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  formWrapper: {
    paddingHorizontal: spacing.screenPadding,
    marginTop: -20,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadius.xl,
    padding: spacing.xl,
    ...spacing.shadow.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.gray100,
    borderRadius: spacing.borderRadius.base,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    borderRadius: spacing.borderRadius.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
    ...spacing.shadow.sm,
  },
  toggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
    fontWeight: typography.fontWeight.semibold,
  },
  formSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: spacing.borderRadius.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
    overflow: 'hidden',
  },
  inputIconWrap: {
    paddingLeft: spacing.base,
    paddingRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.base,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    minHeight: 48,
  },
  eyeBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: spacing.borderRadius.base,
    paddingVertical: spacing.base,
    gap: spacing.sm,
    minHeight: 52,
    ...spacing.shadow.base,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  registerLink: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary,
  },
  errorDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  errorDetailsButtonText: {
    fontSize: typography.fontSize.xs,
    color: colors.error,
    fontWeight: typography.fontWeight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: spacing.borderRadius.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    ...spacing.shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.lg,
    maxHeight: 400,
  },
  errorSection: {
    marginBottom: spacing.base,
  },
  errorLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  errorValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.base,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorStack: {
    fontSize: typography.fontSize.xs,
    color: colors.textPrimary,
    backgroundColor: colors.gray50,
    padding: spacing.sm,
    borderRadius: spacing.borderRadius.base,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    maxHeight: 200,
  },
  modalFooter: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  modalButton: {
    backgroundColor: colors.primary,
    borderRadius: spacing.borderRadius.base,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
