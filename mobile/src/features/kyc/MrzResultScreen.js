import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../../theme';
import { validateMrz, toMinimalPayload } from '../../lib/mrz';
import { maskMrz } from '../../lib/security/maskMrz';
import { api } from '../../services/apiSupabase';

/** Doğum tarihini ISO (YYYY-MM-DD) → DD.MM.YYYY */
function isoToDDMMYYYY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return [d, m, y].filter(Boolean).join('.');
}

/**
 * MRZ okuma sonucu – confirm ekranı. Kaydet ile okutulan kimlikler listesine eklenir (Ayarlar'da görünür).
 */
export default function MrzResultScreen({ route, navigation }) {
  const payload = route?.params?.payload ?? null;
  const raw = payload?.raw ?? '';
  const scanDurationMs = route?.params?.scanDurationMs ?? 0;
  const fromNfc = route?.params?.fromNfc === true;
  const [savingOkutulan, setSavingOkutulan] = useState(false);
  const [savedToOkutulan, setSavedToOkutulan] = useState(false);

  const validation = fromNfc
    ? { valid: !!(payload?.givenNames || payload?.surname) }
    : (payload ? validateMrz(payload) : { valid: false, reason: 'no_payload' });
  const minimal = payload
    ? (fromNfc
      ? {
          passportNumber: payload.passportNumber?.trim() || '',
          birthDate: payload.birthDate || '',
          expiryDate: '',
          issuingCountry: payload.issuingCountry || '',
          docType: payload.docType || 'ID',
        }
      : toMinimalPayload(payload))
    : null;

  const handleConfirm = () => {
    if (!minimal || !validation.valid) return;
    navigation.replace('KycSubmit', { minimal, fromMrz: true });
  };

  const handleRetry = () => {
    navigation.replace('MrzScan');
  };

  const handleKaydetOkutulan = useCallback(async () => {
    if (!payload) return;
    const num = (payload.passportNumber || '').trim();
    const ad = (payload.givenNames || '').trim();
    const soyad = (payload.surname || '').trim();
    if (!ad || !soyad) {
      Toast.show({ type: 'error', text1: 'Eksik bilgi', text2: 'Ad ve soyad olmadan kaydedilemez.' });
      return;
    }
    const isTc = /^\d{11}$/.test(num);
    const body = {
      belgeTuru: isTc ? 'kimlik' : 'pasaport',
      ad,
      soyad,
      kimlikNo: isTc ? num : null,
      pasaportNo: !isTc ? num : null,
      belgeNo: num || null,
      dogumTarihi: payload.birthDate ? isoToDDMMYYYY(payload.birthDate) : null,
      uyruk: (payload.nationality || 'TÜRK').trim(),
    };
    setSavingOkutulan(true);
    try {
      await api.post('/okutulan-belgeler', body);
      setSavedToOkutulan(true);
      Toast.show({ type: 'success', text1: 'Kaydedildi', text2: 'Kaydedilenler sayfasından görüntüleyebilirsiniz.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: e?.response?.data?.message || 'Tekrar deneyin.' });
    } finally {
      setSavingOkutulan(false);
    }
  }, [payload]);

  if (!payload) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Veri bulunamadı</Text>
        <TouchableOpacity style={styles.button} onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate('Main'); }}>
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
        {scanDurationMs > 0 && (
          <View style={styles.scanTimeWrap}>
            <Text style={styles.scanTimeText}>Okuma süresi: {(scanDurationMs / 1000).toFixed(2)} sn</Text>
          </View>
        )}
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
      <TouchableOpacity
        style={[styles.buttonSecondary, styles.buttonSave]}
        onPress={handleKaydetOkutulan}
        disabled={savingOkutulan}
      >
        {savingOkutulan ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Ionicons name={savedToOkutulan ? 'checkmark-circle' : 'save-outline'} size={20} color={theme.colors.primary} />
        )}
        <Text style={styles.buttonSecondaryText}>
          {savedToOkutulan ? 'Kaydedildi' : 'Kaydet (Okutulan kimlikler)'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleConfirm} disabled={!validation.valid}>
        <Text style={styles.buttonText}>Onayla ve devam et</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tekrarTaraButton} onPress={handleRetry} activeOpacity={0.8}>
        <Ionicons name="scan-outline" size={22} color={theme.colors.primary} />
        <Text style={styles.tekrarTaraButtonText}>Tekrar tara</Text>
      </TouchableOpacity>
      {savedToOkutulan && (
        <TouchableOpacity style={styles.buttonSecondary} onPress={() => navigation.navigate('Kaydedilenler')}>
          <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.buttonSecondaryText}>Kaydedilenler sayfasına git</Text>
        </TouchableOpacity>
      )}
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
  scanTimeWrap: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: theme.colors.successSoft || '#E8F5E9', borderRadius: 8, marginBottom: theme.spacing.sm },
  scanTimeText: { fontSize: theme.typography.fontSize.sm, color: theme.colors.success || '#2E7D32', fontWeight: '600' },
  warningText: { color: theme.colors.warning, marginBottom: theme.spacing.base, fontSize: theme.typography.fontSize.sm },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.xs, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  label: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary },
  value: { fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary },
  masked: { fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  errorText: { marginBottom: theme.spacing.lg, color: theme.colors.error },
  button: { ...theme.styles.button.primary, marginBottom: theme.spacing.sm },
  primary: {},
  buttonText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold },
  buttonSecondary: { ...theme.styles.button.outline, marginTop: theme.spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonSecondaryText: { color: theme.colors.primary, fontSize: theme.typography.fontSize.base },
  buttonSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tekrarTaraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: theme.spacing.base,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius?.button ?? 14,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '18',
  },
  tekrarTaraButtonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.primary },
});
