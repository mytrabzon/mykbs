import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking
} from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { dataService } from '../services/dataService';
import Toast from 'react-native-toast-message';

export default function AyarlarScreen() {
  const { logout, tesis, user, setPin } = useAuth();
  const [tesisDetail, setTesisDetail] = useState(null);
  const [kbsSettings, setKbsSettings] = useState({
    kbsTuru: '',
    kbsTesisKodu: '',
    ipKisitAktif: false
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

  const loadKBSSettings = async () => {
    try {
      const response = await api.get('/tesis/kbs');
      setKbsSettings(response.data);
    } catch (error) {
      console.error('KBS ayarları yüklenemedi:', error);
    }
  };

  const handleKBSTest = async () => {
    setLoading(true);
    try {
      const response = await api.post('/tesis/kbs/test');
      setTestResult(response.data);
      
      if (response.data.success) {
        Toast.show({
          type: 'success',
          text1: 'Başarılı',
          text2: 'KBS bağlantısı başarılı'
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Hata',
          text2: response.data.message
        });
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Test başarısız'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/tesis/kbs', {
        ...kbsSettings,
        kbsWebServisSifre: kbsSettings.kbsWebServisSifre // Şifre güvenlik nedeniyle ayrı gönderilmeli
      });
      
      Toast.show({
        type: 'success',
        text1: 'Başarılı',
        text2: 'Ayarlar kaydedildi'
      });
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: error.response?.data?.message || 'Ayarlar kaydedilemedi'
      });
    } finally {
      setLoading(false);
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
      await api.post('/auth/sifre', { sifre: sifreValue, sifreTekrar });
      Toast.show({ type: 'success', text1: 'Başarılı', text2: 'Şifre kaydedildi. Telefon veya email + şifre ile giriş yapabilirsiniz.' });
      setSifreValue('');
      setSifreTekrar('');
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.response?.data?.message || 'Şifre kaydedilemedi' });
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
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tesis Bilgileri</Text>
          <Text style={styles.infoText}>Tesis: {tesis?.tesisAdi}</Text>
          <Text style={styles.infoText}>Paket: {tesis?.paket}</Text>
          <Text style={styles.infoText}>
            Kota: {tesis?.kullanilanKota} / {tesis?.kota}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Giriş Ayarları</Text>
          <Text style={styles.infoText}>
            PIN oluşturursanız giriş ekranında Tesis sekmesinden tesis kodu + PIN ile giriş yapabilirsiniz. Şifre oluşturursanız telefon veya email + şifre ile de giriş yapabilirsiniz.
          </Text>
          <Text style={styles.label}>PIN (Tesis kodu ile giriş)</Text>
          <TextInput
            style={styles.input}
            value={pinValue}
            onChangeText={setPinValue}
            placeholder="En az 4 karakter"
            secureTextEntry
            keyboardType="numeric"
            maxLength={20}
          />
          <TouchableOpacity
            style={[styles.button, pinLoading && styles.buttonDisabled]}
            onPress={handlePinSave}
            disabled={pinLoading || pinValue.length < 4}
          >
            <Text style={styles.buttonText}>{pinLoading ? 'Kaydediliyor...' : 'PIN Kaydet'}</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 20 }]}>Şifre (Telefon/email ile giriş)</Text>
          <TextInput
            style={styles.input}
            value={sifreValue}
            onChangeText={setSifreValue}
            placeholder="En az 6 karakter"
            secureTextEntry
          />
          <TextInput
            style={styles.input}
            value={sifreTekrar}
            onChangeText={setSifreTekrar}
            placeholder="Şifre tekrar"
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.button, sifreLoading && styles.buttonDisabled]}
            onPress={handleSifreSave}
            disabled={sifreLoading || sifreValue.length < 6 || sifreValue !== sifreTekrar}
          >
            <Text style={styles.buttonText}>{sifreLoading ? 'Kaydediliyor...' : 'Şifre Kaydet'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KBS Ayarları</Text>
          {tesisDetail && tesisDetail.kbsConnected === false && (
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Kimlik bildirimi (KBS) bu tesis için henüz yapılandırılmadı. Bağlantı kurulduğunda bu bölümden test edebilirsiniz.
              </Text>
            </View>
          )}

          <Text style={styles.label}>KBS Türü</Text>
          <View style={styles.pickerContainer}>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                kbsSettings.kbsTuru === 'jandarma' && styles.pickerOptionActive
              ]}
              onPress={() => setKbsSettings({ ...kbsSettings, kbsTuru: 'jandarma' })}
            >
              <Text>Jandarma KBS</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.pickerOption,
                kbsSettings.kbsTuru === 'polis' && styles.pickerOptionActive
              ]}
              onPress={() => setKbsSettings({ ...kbsSettings, kbsTuru: 'polis' })}
            >
              <Text>Polis (EMN) KBS</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>KBS Tesis Kodu</Text>
          <TextInput
            style={styles.input}
            value={kbsSettings.kbsTesisKodu}
            onChangeText={(text) =>
              setKbsSettings({ ...kbsSettings, kbsTesisKodu: text })
            }
            placeholder="KBS Tesis Kodu"
          />

          <Text style={styles.label}>Web Servis Şifresi</Text>
          <TextInput
            style={styles.input}
            value={kbsSettings.kbsWebServisSifre || ''}
            onChangeText={(text) =>
              setKbsSettings({ ...kbsSettings, kbsWebServisSifre: text })
            }
            secureTextEntry
            placeholder="Web Servis Şifresi"
          />

          <View style={styles.switchContainer}>
            <Text style={styles.label}>IP Kısıtı</Text>
            <Switch
              value={kbsSettings.ipKisitAktif}
              onValueChange={(value) =>
                setKbsSettings({ ...kbsSettings, ipKisitAktif: value })
              }
            />
          </View>

          <TouchableOpacity
            style={[styles.testButton, loading && styles.buttonDisabled]}
            onPress={handleKBSTest}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>Bağlantıyı Test Et</Text>
          </TouchableOpacity>

          {testResult && (
            <View
              style={[
                styles.testResult,
                testResult.success ? styles.testSuccess : styles.testError
              ]}
            >
              <Text style={styles.testResultText}>{testResult.message}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Kaydet</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İletişim</Text>
          <Text style={styles.contactLabel}>Destek e-posta:</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(`mailto:${Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com'}`)}
          >
            <Text style={styles.contactLink}>
              {Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@litxtech.com'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.contactLabel, { marginTop: 12 }]}>Destek telefon:</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE_TEL || 'tel:08503045061')}
          >
            <Text style={styles.contactLink}>
              {Constants.expoConfig?.extra?.EXPO_PUBLIC_SUPPORT_PHONE || '0850 304 5061'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  content: {
    padding: 20
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333'
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8
  },
  infoBox: {
    backgroundColor: '#e8f4fd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF'
  },
  infoBoxText: {
    fontSize: 14,
    color: '#555'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333'
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  pickerContainer: {
    flexDirection: 'row',
    marginBottom: 15
  },
  pickerOption: {
    flex: 1,
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent'
  },
  pickerOptionActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF'
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15
  },
  testButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 15
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  testResult: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 15
  },
  testSuccess: {
    backgroundColor: '#e8f5e9'
  },
  testError: {
    backgroundColor: '#ffebee'
  },
  testResultText: {
    fontSize: 14,
    color: '#333'
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  logoutButton: {
    backgroundColor: '#f44336',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center'
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  contactLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4
  },
  contactLink: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline'
  }
});

