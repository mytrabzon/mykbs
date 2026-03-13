import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as FileSystem from 'expo-file-system/legacy';
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
  const insets = useSafeAreaInsets();
  const payload = route?.params?.payload ?? null;
  const raw = payload?.raw ?? '';
  const scanDurationMs = route?.params?.scanDurationMs ?? 0;
  const fromNfc = route?.params?.fromNfc === true;
  const photoUri = route?.params?.photoUri ?? null;
  const portraitBase64 = route?.params?.portraitBase64 ?? null;
  const [savingOkutulan, setSavingOkutulan] = useState(false);
  const [savedToOkutulan, setSavedToOkutulan] = useState(false);

  const handleGeri = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('MrzScan');
  };

  const chipPhotoBase64 = payload?.chipPhotoBase64 && typeof payload.chipPhotoBase64 === 'string' ? payload.chipPhotoBase64 : null;
  const displayPhotoUri = portraitBase64 ? `data:image/jpeg;base64,${portraitBase64}` : chipPhotoBase64 ? `data:image/jpeg;base64,${chipPhotoBase64}` : photoUri;

  const validation = fromNfc
    ? { valid: !!((payload?.givenNames || payload?.ad) && (payload?.surname || payload?.soyad)), reason: null }
    : (payload ? validateMrz(payload) : { valid: false, reason: 'no_payload' });
  const minimal = payload
    ? (fromNfc
      ? {
          passportNumber: (payload.passportNumber || payload.kimlikNo || payload.pasaportNo || '').trim() || '',
          birthDate: payload.birthDate || (payload.dogumTarihi ? payload.dogumTarihi.split('.').reverse().join('-') : '') || '',
          expiryDate: payload.expiryDate || (payload.sonKullanma ? payload.sonKullanma.split('.').reverse().join('-') : '') || '',
          issuingCountry: (payload.issuingCountry || payload.nationality || '').trim().slice(0, 3) || '',
          docType: payload.docType || 'ID',
        }
      : toMinimalPayload(payload))
    : null;

  /** Kontrol hanesi hatalı olsa bile belge no + tarih + ad/soyad varsa bilgi ekranına (KycSubmit) geçilebilir. */
  const hasMinimalData =
    minimal &&
    (minimal.passportNumber || '').trim() &&
    (payload?.birthDate || payload?.dogumTarihi) &&
    (payload?.expiryDate || payload?.sonKullanma) &&
    ((payload?.givenNames || payload?.ad || '').trim() || (payload?.surname || payload?.soyad || '').trim());
  const canProceed = !!minimal && (validation.valid || hasMinimalData);

  const handleConfirm = () => {
    if (!minimal || !canProceed) return;
    navigation.replace('KycSubmit', { minimal, fromMrz: true });
  };

  const handleRetry = () => {
    navigation.replace('MrzScan');
  };

  const handleKaydetOkutulan = useCallback(async () => {
    if (!payload) return;
    const num = (payload.passportNumber || payload.kimlikNo || payload.pasaportNo || '').trim();
    const ad = (payload.givenNames || payload.ad || '').trim();
    const soyad = (payload.surname || payload.soyad || '').trim();
    if (!ad || !soyad) {
      Toast.show({ type: 'error', text1: 'Eksik bilgi', text2: 'Ad ve soyad olmadan kaydedilemez. MRZ ile tekrar okuyabilirsiniz.' });
      return;
    }
    const isTc = /^\d{11}$/.test(num);
    const dogumTarihi = payload.birthDate ? isoToDDMMYYYY(payload.birthDate) : (payload.dogumTarihi || null);
    const body = {
      belgeTuru: isTc ? 'kimlik' : 'pasaport',
      ad,
      soyad,
      kimlikNo: isTc ? num : null,
      pasaportNo: !isTc ? num : null,
      belgeNo: num || null,
      dogumTarihi,
      uyruk: (payload.nationality || payload.uyruk || 'TÜRK').trim(),
    };
    if (photoUri && typeof photoUri === 'string') {
      try {
        const base64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
        if (base64) body.photoBase64 = base64;
      } catch (_) {}
    }
    const portrait = portraitBase64 || chipPhotoBase64;
    if (portrait && typeof portrait === 'string') body.portraitPhotoBase64 = portrait;
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
  }, [payload, photoUri, portraitBase64, chipPhotoBase64]);

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
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 8 }]}>
        <TouchableOpacity onPress={handleGeri} style={styles.headerBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          <Text style={styles.headerBackText}>Geri</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Belge sonucu</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
        {!validation.valid && validation.reason && !fromNfc && (
          <Text style={styles.warningText}>{validation.reason === 'document_expired' ? 'Belge süresi dolmuş.' : 'Check digit veya tarih hatası. Tekrar tarayın veya manuel girin.'}</Text>
        )}
        {fromNfc && !validation.valid && (
          <Text style={styles.warningText}>Ad/soyad çipten okunamadı. Kaydetmek için MRZ ile tekrar okuyabilir veya belge no ile kaydedebilirsiniz.</Text>
        )}
        {displayPhotoUri ? (
          <View style={styles.photoWrap}>
            <Image source={{ uri: displayPhotoUri }} style={styles.photo} resizeMode="cover" />
            <Text style={styles.photoLabel}>{(portraitBase64 || chipPhotoBase64) ? 'Kimlik resmi' : 'Belge'}</Text>
          </View>
        ) : null}
        <Row label="Belge no" value={payload.passportNumber || payload.kimlikNo || payload.pasaportNo} mask />
        <Row label="Ülke" value={payload.issuingCountry || payload.nationality || payload.uyruk} />
        <Row label="Doğum" value={payload.birthDate || payload.dogumTarihi} />
        <Row label="Son kullanma" value={payload.expiryDate || payload.sonKullanma} />
        <Row label="Soyad" value={payload.surname || payload.soyad} />
        <Row label="Ad" value={payload.givenNames || payload.ad} />
        <Text style={styles.masked}>{fromNfc ? 'NFC ile okundu' : `MRZ (maske): ${maskMrz(raw)}`}</Text>
      </View>
      <TouchableOpacity
        style={[styles.buttonSecondary, styles.buttonSave]}
        onPress={handleKaydetOkutulan}
        disabled={savingOkutulan}
        activeOpacity={0.8}
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
      <TouchableOpacity style={[styles.button, styles.primary]} onPress={handleConfirm} disabled={!canProceed} activeOpacity={0.8}>
        <Text style={[styles.buttonText, !canProceed && styles.buttonTextDisabled]}>{validation.valid ? 'Onayla ve devam et' : 'Bilgi / doğrulama ekranına geç'}</Text>
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
    </View>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.base, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerBack: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 8, marginLeft: -44 },
  headerBackText: { fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary, marginLeft: 4 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, color: theme.colors.textPrimary },
  headerPlaceholder: { width: 80 },
  scroll: { flex: 1 },
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
  photoWrap: { alignSelf: 'center', width: 120, height: 150, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.colors.gray100 || '#f0f0f0', marginBottom: theme.spacing.base },
  photo: { width: '100%', height: '100%' },
  photoLabel: { fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4 },
  masked: { fontSize: 12, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  errorText: { marginBottom: theme.spacing.lg, color: theme.colors.error },
  button: { ...theme.styles.button.primary, marginBottom: theme.spacing.sm },
  primary: {},
  buttonText: { color: '#fff', fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold },
  buttonTextDisabled: { opacity: 0.7 },
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
