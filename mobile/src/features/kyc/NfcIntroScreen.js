import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

let NfcManager = null;
try {
  NfcManager = require('react-native-nfc-manager').default;
} catch (e) {}

/**
 * V2 altyapı: "Telefonunu pasaporta yaklaştır" – sadece NFC hazır mı kontrolü.
 * Gerçek NFC okuma V2'de native modül ile yapılacak.
 */
export default function NfcIntroScreen({ navigation }) {
  const [supported, setSupported] = useState(null);
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    if (!NfcManager) {
      setSupported(false);
      return;
    }
    NfcManager.isSupported().then(setSupported).catch(() => setSupported(false));
    NfcManager.isEnabled().then(setEnabled).catch(() => setEnabled(false));
  }, []);

  const notReady = supported === false || enabled === false;

  return (
    <View style={styles.container}>
      <Ionicons name="phone-portrait-outline" size={80} color={theme.colors.primary} />
      <Text style={styles.title}>NFC ile okuma</Text>
      <Text style={styles.subtitle}>Telefonunuzu pasaportun çipine yaklaştırın (V2'de aktif olacak).</Text>
      {supported === false && <Text style={styles.warn}>Bu cihaz NFC desteklemiyor.</Text>}
      {supported === true && enabled === false && <Text style={styles.warn}>NFC kapalı. Ayarlardan açın.</Text>}
      {supported === true && enabled === true && <Text style={styles.ok}>NFC hazır.</Text>}
      <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Tamam</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.xl, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  subtitle: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: theme.spacing.xl },
  warn: { color: theme.colors.warning, marginBottom: theme.spacing.base },
  ok: { color: theme.colors.success, marginBottom: theme.spacing.base },
  button: { ...theme.styles.button.primary, marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.xl },
  buttonText: { color: '#fff', fontWeight: theme.typography.fontWeight.semibold },
});
