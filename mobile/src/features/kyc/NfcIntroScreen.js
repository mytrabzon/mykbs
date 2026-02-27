import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

let NfcManager = null;
try {
  NfcManager = require('react-native-nfc-manager').default;
} catch (e) {}

/**
 * NFC ile pasaport çipi okuma: MRZ okunduktan sonra BAC key ile okuma yapılır.
 * Hata durumunda nfcStatus / errorCode UI'da gösterilir.
 */
export default function NfcIntroScreen({ navigation, route }) {
  const [supported, setSupported] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [nfcStatus, setNfcStatus] = useState('idle'); // idle | reading | ok | error
  const [errorCode, setErrorCode] = useState(null);

  useEffect(() => {
    if (!NfcManager) {
      setSupported(false);
      return;
    }
    NfcManager.isSupported().then(setSupported).catch(() => setSupported(false));
    NfcManager.isEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  const hasMrz = route?.params?.mrzPayload != null;
  const notReady = supported === false || enabled === false;

  const statusMessage =
    nfcStatus === 'reading' ? 'Okunuyor… Telefonu kapağa yaklaştırın.'
    : nfcStatus === 'error' ? (errorCode ? `Hata: ${errorCode}` : 'Okuma başarısız.')
    : nfcStatus === 'ok' ? 'Çip okundu.'
    : null;

  return (
    <View style={styles.container}>
      <Ionicons name="phone-portrait-outline" size={80} color={theme.colors.primary} />
      <Text style={styles.title}>NFC ile okuma</Text>
      <Text style={styles.subtitle}>
        Önce MRZ okutun, sonra NFC'ye geçin. BAC anahtarı MRZ'den üretilir; MRZ yoksa çip okunamaz.
      </Text>
      {!hasMrz && (
        <Text style={styles.tip}>
          💡 Pasaport arka yüzündeki MRZ çizgilerini "Kamera ile MRZ" ile okutun, ardından bu ekrandan NFC okumayı başlatın.
        </Text>
      )}
      {supported === false && <Text style={styles.warn}>Bu cihaz NFC desteklemiyor.</Text>}
      {supported === true && enabled === false && <Text style={styles.warn}>NFC kapalı. Ayarlardan açın.</Text>}
      {supported === true && enabled === true && <Text style={styles.ok}>NFC hazır.</Text>}
      {statusMessage && <Text style={[styles.statusMsg, nfcStatus === 'error' && styles.statusError]}>{statusMessage}</Text>}
      {errorCode && <Text style={styles.errorCode}>Kod: {errorCode}</Text>}
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Tamam</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  subtitle: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.sm },
  tip: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.base, paddingHorizontal: theme.spacing.base },
  warn: { color: theme.colors.warning, marginBottom: theme.spacing.base },
  ok: { color: theme.colors.success, marginBottom: theme.spacing.base },
  statusMsg: { marginTop: theme.spacing.sm, color: theme.colors.textPrimary },
  statusError: { color: theme.colors.error },
  errorCode: { fontSize: theme.typography.fontSize.caption, color: theme.colors.textSecondary, marginTop: 4 },
  button: { ...theme.styles.button.primary, marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.xl },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
});
