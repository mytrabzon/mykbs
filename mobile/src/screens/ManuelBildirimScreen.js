import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme';
import { api } from '../services/api';

const MISAFIR_TIPLERI = [
  { value: 'tc_vatandasi', label: 'T.C. Vatandaşı' },
  { value: 'ykn', label: 'YKN' },
  { value: 'yabanci', label: 'Yabancı' },
];

function parseDateStr(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const d = trimmed.split(/[.\-/]/);
  if (d.length !== 3) return null;
  const day = parseInt(d[0], 10);
  const month = parseInt(d[1], 10) - 1;
  const year = parseInt(d[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export default function ManuelBildirimScreen({ navigation }) {
  const [kimlikNo, setKimlikNo] = useState('');
  const [pasaportNo, setPasaportNo] = useState('');
  const [ad, setAd] = useState('');
  const [soyad, setSoyad] = useState('');
  const [babaAdi, setBabaAdi] = useState('');
  const [anaAdi, setAnaAdi] = useState('');
  const [dogumTarihi, setDogumTarihi] = useState('');
  const [uyruk, setUyruk] = useState('Türkiye');
  const [odaNumarasi, setOdaNumarasi] = useState('');
  const [misafirTipi, setMisafirTipi] = useState('tc_vatandasi');
  const [telefon, setTelefon] = useState('');
  const [plaka, setPlaka] = useState('');
  const [girisTarihi, setGirisTarihi] = useState('');
  const [odalar, setOdalar] = useState([]);
  const [odalarLoading, setOdalarLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    setOdalarLoading(true);
    api.get('/oda?filtre=bos')
      .then((res) => setOdalar(res.data?.odalar ?? []))
      .catch(() => setOdalar([]))
      .finally(() => setOdalarLoading(false));
  }, []);

  const handleSubmit = useCallback(async () => {
    const tc = (kimlikNo || '').trim();
    const pasaport = (pasaportNo || '').trim();
    if (!tc && !pasaport) {
      Toast.show({ type: 'info', text1: 'TC veya pasaport girin', text2: 'En az biri zorunludur.' });
      return;
    }
    if (!(ad || '').trim()) {
      Toast.show({ type: 'info', text1: 'Ad girin' });
      return;
    }
    if (!(soyad || '').trim()) {
      Toast.show({ type: 'info', text1: 'Soyad girin' });
      return;
    }
    if (!(babaAdi || '').trim()) {
      Toast.show({ type: 'info', text1: 'Baba adı zorunludur' });
      return;
    }
    if (!(anaAdi || '').trim()) {
      Toast.show({ type: 'info', text1: 'Ana adı zorunludur' });
      return;
    }
    const dogum = parseDateStr(dogumTarihi);
    if (!dogum) {
      Toast.show({ type: 'info', text1: 'Doğum tarihi girin', text2: 'Örn: 15.05.1990' });
      return;
    }
    if (!(uyruk || '').trim()) {
      Toast.show({ type: 'info', text1: 'Uyruk girin' });
      return;
    }
    const odaNo = (odaNumarasi || '').trim();
    if (!odaNo) {
      Toast.show({ type: 'info', text1: 'Oda numarası seçin veya yazın' });
      return;
    }

    setSubmitLoading(true);
    try {
      const payload = {
        ad: ad.trim(),
        soyad: soyad.trim(),
        babaAdi: babaAdi.trim(),
        anaAdi: anaAdi.trim(),
        dogumTarihi: dogum,
        uyruk: uyruk.trim(),
        odaNumarasi: odaNo,
        misafirTipi: misafirTipi || undefined,
      };
      if (tc) payload.kimlikNo = tc;
      if (pasaport) payload.pasaportNo = pasaport;
      if ((telefon || '').trim()) payload.telefon = telefon.trim();
      if ((plaka || '').trim()) payload.plaka = plaka.trim();
      const girisParsed = parseDateStr(girisTarihi);
      if (girisParsed) payload.girisTarihi = girisParsed;

      await api.post('/misafir/manuel-bildirim', payload);
      Toast.show({
        type: 'success',
        text1: 'KBS\'ye bildirildi',
        text2: `${ad.trim()} ${soyad.trim()} · Oda ${odaNo}`,
      });
      navigation.goBack();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Bildirim gönderilemedi';
      Toast.show({ type: 'error', text1: 'Hata', text2: msg });
    } finally {
      setSubmitLoading(false);
    }
  }, [
    kimlikNo,
    pasaportNo,
    ad,
    soyad,
    babaAdi,
    anaAdi,
    dogumTarihi,
    uyruk,
    odaNumarasi,
    misafirTipi,
    telefon,
    plaka,
    girisTarihi,
    navigation,
  ]);

  const todayStr = (() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  })();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manuel KBS bildirimi</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionSubtitle}>
            Belge okutmadan TC, ad soyad, baba adı, ana adı, doğum tarihi, uyruk ve oda no ile KBS'ye bildirim yapın.
          </Text>

          <Text style={styles.label}>TC No</Text>
          <TextInput
            style={styles.input}
            value={kimlikNo}
            onChangeText={setKimlikNo}
            placeholder="11 haneli"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="number-pad"
            maxLength={11}
          />

          <Text style={styles.label}>Pasaport No (TC yoksa)</Text>
          <TextInput
            style={styles.input}
            value={pasaportNo}
            onChangeText={setPasaportNo}
            placeholder="Opsiyonel"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Ad</Text>
          <TextInput
            style={styles.input}
            value={ad}
            onChangeText={setAd}
            placeholder="Ad"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Soyad</Text>
          <TextInput
            style={styles.input}
            value={soyad}
            onChangeText={setSoyad}
            placeholder="Soyad"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Baba adı *</Text>
          <TextInput
            style={styles.input}
            value={babaAdi}
            onChangeText={setBabaAdi}
            placeholder="Zorunlu"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Ana adı *</Text>
          <TextInput
            style={styles.input}
            value={anaAdi}
            onChangeText={setAnaAdi}
            placeholder="Zorunlu"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Doğum tarihi</Text>
          <TextInput
            style={styles.input}
            value={dogumTarihi}
            onChangeText={setDogumTarihi}
            placeholder="GG.AA.YYYY örn: 15.05.1990"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Uyruk</Text>
          <TextInput
            style={styles.input}
            value={uyruk}
            onChangeText={setUyruk}
            placeholder="Türkiye, Almanya vb."
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Misafir tipi</Text>
          <View style={styles.misafirTipiRow}>
            {MISAFIR_TIPLERI.map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[styles.misafirTipiBtn, misafirTipi === value && styles.misafirTipiBtnActive]}
                onPress={() => setMisafirTipi(value)}
              >
                <Text style={[styles.misafirTipiBtnText, misafirTipi === value && styles.misafirTipiBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Oda no</Text>
          {odalarLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.odaLoader} />
          ) : odalar.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.odaScroll}>
              {odalar.map((oda) => (
                <TouchableOpacity
                  key={oda.id}
                  style={[styles.odaChip, odaNumarasi === oda.odaNumarasi && styles.odaChipActive]}
                  onPress={() => setOdaNumarasi(oda.odaNumarasi)}
                >
                  <Text style={[styles.odaChipText, odaNumarasi === oda.odaNumarasi && styles.odaChipTextActive]}>
                    {oda.odaNumarasi}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
          <TextInput
            style={styles.input}
            value={odaNumarasi}
            onChangeText={setOdaNumarasi}
            placeholder="Oda numarası yazın veya yukarıdan seçin"
            placeholderTextColor={theme.colors.textSecondary}
          />

          <Text style={styles.labelOptional}>İsteğe bağlı</Text>

          <Text style={styles.label}>Telefon</Text>
          <TextInput
            style={styles.input}
            value={telefon}
            onChangeText={setTelefon}
            placeholder="Örn: 532 123 45 67"
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Plaka</Text>
          <TextInput
            style={styles.input}
            value={plaka}
            onChangeText={setPlaka}
            placeholder="Araç plakası"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Giriş tarihi</Text>
          <TextInput
            style={styles.input}
            value={girisTarihi}
            onChangeText={setGirisTarihi}
            placeholder={`Boş bırakırsanız bugün (${todayStr}) kullanılır`}
            placeholderTextColor={theme.colors.textSecondary}
            keyboardType="numbers-and-punctuation"
          />

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.colors.primary }]}
            onPress={handleSubmit}
            disabled={submitLoading}
          >
            {submitLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>KBS'ye bildir</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.screenPadding,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -44,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  headerPlaceholder: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.screenPadding, paddingBottom: theme.spacing['4xl'] },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: theme.spacing.sm,
  },
  labelOptional: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xl,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.borderRadius.input,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.textPrimary,
  },
  misafirTipiRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  misafirTipiBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  misafirTipiBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  misafirTipiBtnText: { fontSize: 14, color: theme.colors.textSecondary },
  misafirTipiBtnTextActive: { color: theme.colors.primary, fontWeight: '600' },
  odaLoader: { marginVertical: 8 },
  odaScroll: { marginBottom: 8, maxHeight: 44 },
  odaChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  odaChipActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  odaChipText: { fontSize: 14, color: theme.colors.textSecondary },
  odaChipTextActive: { color: theme.colors.primary, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.spacing.borderRadius.button,
    marginTop: theme.spacing.xl,
  },
  submitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
