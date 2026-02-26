import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';
import { validateMrz, toMinimalPayload } from '../../lib/mrz';
import { maskMrz } from '../../lib/security/maskMrz';

/**
 * MRZ okuma sonucu – confirm ekranı. Sadece onay sonrası server'a gönderim (roadmap).
 */
export default function MrzResultScreen({ route, navigation }) {
  const payload = route?.params?.payload ?? null;
  const raw = payload?.raw ?? '';

  const validation = payload ? validateMrz(payload) : { valid: false, reason: 'no_payload' };
  const minimal = payload ? toMinimalPayload(payload) : null;

  const handleConfirm = () => {
    if (!minimal || !validation.valid) return;
    navigation.replace('KycSubmit', { minimal, fromMrz: true });
  };

  const handleRetry = () => {
    navigation.replace('MrzScan');
  };

  if (!payload) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Veri bulunamadı</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name={validation.valid ? 'checkmark-circle' : 'warning'} size={32} color={validation.valid ? theme.colors.success : theme.colors.warning} />
          <Text style={styles.title}>{validation.valid ? 'MRZ okundu' : 'Kontrol gerekli'}</Text>
        </View>
        {!validation.valid && validation.reason && (
          <Text style={styles.warningText}>{validation.reason === 'document_expired' ? 'Belge süresi dolmuş.' : 'Check digit veya tarih hatası. Tekrar tarayın veya manuel girin.'}</Text>
        )}
        <Row label="Belge no" value={payload.passportNumber} mask />
        <Row label="Ülke" value={payload.issuingCountry} />
        <Row label="Doğum" value={payload.birthDate} />
        <Row label="Son kullanma" value={payload.expiryDate} />
        <Row label="Soyad" value={payload.surname} />
        <Row label="Ad" value={payload.givenNames} />
        <Text style={styles.masked}>MRZ (maske): {maskMrz(raw)}</Text>
      </View>
      <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleConfirm} disabled={!validation.valid}>
        <Text style={styles.buttonText}>Onayla ve devam et</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.buttonSecondary} onPress={handleRetry}>
        <Text style={styles.buttonSecondaryText}>Tekrar tara</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value, mask }) {
  const display = value != null && value !== '' ? (mask ? value.slice(0, 2) + '****' + value.slice(-2) : value) : '—';
  return (
    <View style={styles.rowLine}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  card: { ...theme.styles.card, marginBottom: theme.spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.textPrimary, marginLeft: theme.spacing.sm },
  warningText: { color: theme.colors.warning, marginBottom: theme.spacing.base, fontSize: theme.typography.fontSize.sm },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  label: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary },
  value: { fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary },
  masked: { fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  errorText: { marginBottom: theme.spacing.lg, color: theme.colors.error },
  button: { ...theme.styles.button.primary, marginBottom: theme.spacing.sm },
  primary: {},
  buttonText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold },
  buttonSecondary: { ...theme.styles.button.outline, marginTop: theme.spacing.xs },
  buttonSecondaryText: { color: theme.colors.primary, fontSize: theme.typography.fontSize.base },
});
