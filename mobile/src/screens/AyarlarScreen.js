import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { supabase } from '../lib/supabase/supabase';
import { dataService } from '../services/dataService';
import { backendHealth } from '../services/backendHealth';
import { getApiBaseUrl, isSupabaseConfigured } from '../config/api';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { Button, Banner, SegmentedControl, Input } from '../components/ui';
import { typography, spacing } from '../theme';
import AppHeader from '../components/AppHeader';

export default function AyarlarScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { logout, tesis, user, setPin, setTesis } = useAuth();
  const [tesisDetail, setTesisDetail] = useState(null);
  const [tesisAdiEdit, setTesisAdiEdit] = useState('');
  const [tesisAdiSaving, setTesisAdiSaving] = useState(false);
  const canEditTesis = user?.yetkiler?.bilgiDuzenleme === true;
  const [kbsSettings, setKbsSettings] = useState({
    kbsTuru: '',
    kbsTesisKodu: '',
    kbsWebServisSifre: '',
    ipKisitAktif: false,
  });
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [sifreValue, setSifreValue] = useState('');
  const [sifreTekrar, setSifreTekrar] = useState('');
  const [sifreLoading, setSifreLoading] = useState(false);

  useEffect(() => {
    loadKBSSettings();
    dataService.getTesis(true).then((t) => setTesisDetail(t)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tesis?.tesisAdi != null && tesisAdiEdit === '') setTesisAdiEdit(tesis.tesisAdi);
  }, [tesis?.tesisAdi]);

  const handleTesisAdiSave = async () => {
    const name = (tesisAdiEdit && String(tesisAdiEdit).trim()) || '';
    if (!name) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Tesis adı boş olamaz' });
      return;
    }
    setTesisAdiSaving(true);
    try {
      const res = await api.put('/tesis/bilgi', { tesisAdi: name });
      if (res.data?.tesis && setTesis) {
        setTesis({ ...tesis, tesisAdi: res.data.tesis.tesisAdi });
      }
      Toast.show({ type: 'success', text1: 'Kaydedildi', text2: 'Tesis adı güncellendi' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Tesis adı güncellenemedi' });
    } finally {
      setTesisAdiSaving(false);
    }
  };

  const loadKBSSettings = async () => {
    try {
      const response = await api.get('/tesis/kbs');
      setKbsSettings((prev) => ({ ...prev, ...response.data }));
    } catch (e) {
      console.error('KBS ayarları yüklenemedi:', e);
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      if (status === 401) {
        Toast.show({
          type: 'error',
          text1: 'Giriş gerekli',
          text2: 'Tekrar giriş yapın.',
          visibilityTime: 5000,
        });
      } else if (msg) {
        Toast.show({ type: 'error', text1: 'KBS ayarları', text2: msg, visibilityTime: 4000 });
      }
    }
  };

  const handleKBSTest = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const response = await api.post('/tesis/kbs/test');
      setTestResult(response.data);
      if (response.data.success) {
        Toast.show({ type: 'success', text1: 'Başarılı', text2: 'KBS bağlantısı başarılı' });
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: response.data.message });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Test başarısız' });
      setTestResult({ success: false, message: e?.response?.data?.message || 'Test başarısız' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/tesis/kbs', {
        ...kbsSettings,
        kbsWebServisSifre: kbsSettings.kbsWebServisSifre,
      });
      Toast.show({ type: 'success', text1: 'Başarılı', text2: 'Ayarlar kaydedildi' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Ayarlar kaydedilemedi' });
      // Hata olsa bile tesis kodu ve şifre sıfırlanmaz (kbsSettings state değiştirilmez)
    } finally {
      setLoading(false);
    }
  };

  const handleKbsTalep = async (type) => {
    try {
      await api.post('/tesis/kbs/talebi', { type });
      Toast.show({ type: 'success', text1: 'Talep iletildi', text2: 'Admin onayından sonra işlem yapılacaktır.', visibilityTime: 4000 });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Talep gönderilemedi' });
    }
  };

  const handlePinSave = async () => {
    if (!pinValue || pinValue.length < 4) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'PIN en az 4 karakter olmalıdır' });
      return;
    }
    setPinLoading(true);
    try {
      const result = await setPin(pinValue, false);
      if (result.success) {
        Toast.show({ type: 'success', text1: 'Başarılı', text2: 'PIN kaydedildi. Tesis kodu + PIN ile giriş yapabilirsiniz.' });
        setPinValue('');
      } else {
        Toast.show({ type: 'error', text1: 'Hata', text2: result.message || 'PIN kaydedilemedi' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'PIN kaydedilemedi' });
    } finally {
      setPinLoading(false);
    }
  };

  const handleSifreSave = async () => {
    if (!sifreValue || sifreValue.length < 6) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Şifre en az 6 karakter olmalıdır' });
      return;
    }
    if (sifreValue !== sifreTekrar) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Şifreler eşleşmiyor' });
      return;
    }
    setSifreLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: sifreValue });
        if (error) throw error;
      } else {
        await api.post('/auth/sifre', { sifre: sifreValue, sifreTekrar });
      }
      Toast.show({ type: 'success', text1: 'Başarılı', text2: 'Şifre kaydedildi.' });
      setSifreValue('');
      setSifreTekrar('');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || e?.response?.data?.message || 'Şifre kaydedilemedi' });
    } finally {
      setSifreLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
      ]
    );
  };

  const supportEmail = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com';
  const supportPhone = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE || '0850 304 5061';
  const supportPhoneTel = Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE_TEL || 'tel:08503045061';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Ayarlar"
        tesis={tesis}
        backendConfigured={backendStatus.configured}
        backendOnline={backendStatus.isOnline}
        backendError={backendStatus.error}
        supabaseConfigured={supabaseStatus.configured}
        supabaseOnline={supabaseStatus.isOnline}
        supabaseError={supabaseStatus.error}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('ProfilDuzenle')}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profil</Text>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('ProfilDuzenle')}
          >
            <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>Profil düzenle & avatar</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Kimlik / Pasaport</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Check-in ekranında kimlik veya pasaportu kamerayla okutabilir veya numarayı manuel girebilirsiniz.
          </Text>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('MrzScan')}
          >
            <Text style={[styles.menuRowText, { color: colors.textPrimary }]}>Kimlik doğrula (MRZ tara)</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Tesis Bilgileri</Text>
          {canEditTesis ? (
            <>
              <Input
                label="Tesis / Otel adı"
                value={tesisAdiEdit}
                onChangeText={setTesisAdiEdit}
                placeholder="Örn. Örnek Otel"
              />
              <Button
                variant="secondary"
                onPress={handleTesisAdiSave}
                loading={tesisAdiSaving}
                disabled={tesisAdiSaving || (tesisAdiEdit || '').trim() === '' || (tesisAdiEdit || '').trim() === (tesis?.tesisAdi || '')}
              >
                Tesis adını kaydet
              </Button>
            </>
          ) : (
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Tesis: {tesis?.tesisAdi}</Text>
          )}
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Paket: {tesis?.paket}</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            Kota: {tesis?.kullanilanKota} / {tesis?.kota}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Giriş Ayarları</Text>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            PIN: tesis kodu + PIN ile giriş. Şifre: telefon veya e-posta + şifre ile giriş.
          </Text>
          <Input
            label="PIN (Tesis kodu ile giriş)"
            value={pinValue}
            onChangeText={setPinValue}
            placeholder="En az 4 karakter"
            secureTextEntry
            keyboardType="numeric"
            maxLength={20}
          />
          <Button variant="secondary" onPress={handlePinSave} loading={pinLoading} disabled={pinLoading || pinValue.length < 4}>
            PIN Kaydet
          </Button>

          <Text style={[styles.label, { color: colors.textPrimary, marginTop: spacing.lg }]}>Şifre (Telefon/e-posta ile giriş)</Text>
          <Input value={sifreValue} onChangeText={setSifreValue} placeholder="En az 6 karakter" secureTextEntry />
          <Input value={sifreTekrar} onChangeText={setSifreTekrar} placeholder="Şifre tekrar" secureTextEntry />
          <Button
            variant="secondary"
            onPress={handleSifreSave}
            loading={sifreLoading}
            disabled={sifreLoading || sifreValue.length < 6 || sifreValue !== sifreTekrar}
          >
            Şifre Kaydet
          </Button>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>KBS Ayarları</Text>
          {tesisDetail && tesisDetail.kbsConnected === false && (
            <Banner
              type="info"
              message="Kimlik bildirimi (KBS) bu tesis için henüz yapılandırılmadı. Bağlantı kurulduğunda bu bölümden test edebilirsiniz."
            />
          )}

          <Text style={[styles.label, { color: colors.textPrimary }]}>KBS Türü</Text>
          <SegmentedControl
            options={[
              { key: 'jandarma', label: 'Jandarma KBS' },
              { key: 'polis', label: 'Polis (EMN) KBS' },
            ]}
            value={kbsSettings.kbsTuru}
            onChange={(v) => setKbsSettings((prev) => ({ ...prev, kbsTuru: v }))}
            style={styles.segmented}
          />

          <Input
            label="KBS Tesis Kodu"
            value={kbsSettings.kbsTesisKodu}
            onChangeText={(t) => setKbsSettings((prev) => ({ ...prev, kbsTesisKodu: t }))}
            placeholder="KBS Tesis Kodu"
          />
          <Input
            label="Web Servis Şifresi"
            value={kbsSettings.kbsWebServisSifre || ''}
            onChangeText={(t) => setKbsSettings((prev) => ({ ...prev, kbsWebServisSifre: t }))}
            placeholder="Web Servis Şifresi"
            secureTextEntry
          />

          <View style={[styles.switchRow, { borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>IP Kısıtı</Text>
            <Switch
              value={kbsSettings.ipKisitAktif}
              onValueChange={(v) => setKbsSettings((prev) => ({ ...prev, ipKisitAktif: v }))}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={kbsSettings.ipKisitAktif ? colors.primary : colors.textSecondary}
            />
          </View>

          <Button variant="secondary" onPress={handleKBSTest} loading={loading} disabled={loading}>
            Bağlantıyı Test Et
          </Button>
          {testResult && (
            <View
              style={[
                styles.testResult,
                { backgroundColor: testResult.success ? colors.successSoft : colors.errorSoft },
              ]}
            >
              <Text style={[styles.testResultText, { color: colors.textPrimary }]}>{testResult.message}</Text>
            </View>
          )}

          <Button variant="primary" onPress={handleSave} loading={loading} disabled={loading} style={styles.saveBtn}>
            Kaydet
          </Button>

          <Text style={[styles.infoText, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            KBS tesis kodu ve şifresi kaydedildikten sonra yalnızca admin onayı ile değiştirilebilir veya kaldırılabilir.
          </Text>
          <View style={styles.kbsTalepRow}>
            <Button variant="secondary" onPress={() => handleKbsTalep('change')} style={styles.kbsTalepBtn}>
              Değişiklik talebi
            </Button>
            <Button variant="secondary" onPress={() => handleKbsTalep('remove')} style={[styles.kbsTalepBtn, { borderColor: colors.error }]}>
              Kaldırma talebi
            </Button>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>İletişim</Text>
          <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Destek e-posta:</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`mailto:${supportEmail}`)}>
            <Text style={[styles.contactLink, { color: colors.primary }]}>{supportEmail}</Text>
          </TouchableOpacity>
          <Text style={[styles.contactLabel, { color: colors.textSecondary }]}>Destek telefon:</Text>
          <TouchableOpacity onPress={() => Linking.openURL(supportPhoneTel)}>
            <Text style={[styles.contactLink, { color: colors.primary }]}>{supportPhone}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Button variant="destructive" onPress={handleLogout}>
            Çıkış Yap
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.screenPadding, paddingBottom: 120 },
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
  infoText: { fontSize: typography.text.body.fontSize, marginBottom: spacing.xs },
  label: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  segmented: { marginBottom: spacing.md },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  testResult: {
    padding: spacing.md,
    borderRadius: spacing.borderRadius.input,
    marginBottom: spacing.md,
  },
  testResultText: { fontSize: typography.text.body.fontSize },
  saveBtn: { marginTop: spacing.xs },
  kbsTalepRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  kbsTalepBtn: { flex: 1 },
  contactLabel: { fontSize: typography.text.body.fontSize, marginBottom: 4 },
  contactLink: { fontSize: typography.text.body.fontSize },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  menuRowText: { fontSize: typography.text.body.fontSize },
});
