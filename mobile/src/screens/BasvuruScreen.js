import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { testAccountManager } from '../utils/testAccount';
import ErrorBoundary from '../components/ErrorBoundary';

export default function BasvuruScreen({ navigation }) {
  const [formData, setFormData] = useState({
    tesisAdi: '',
    yetkiliAdSoyad: '',
    telefon: '',
    email: '',
    il: '',
    ilce: '',
    adres: '',
    odaSayisi: '',
    tesisTuru: 'otel',
    kbsTuru: '',
    kbsTesisKoduVarMi: '',
    kbsKullanimDurumu: '',
    vergiNo: '',
    unvan: '',
    web: '',
    instagram: '',
    not: ''
  });
  const [loading, setLoading] = useState(false);
  const [testAccount, setTestAccount] = useState(null);
  const [showTestAccount, setShowTestAccount] = useState(false);

  useEffect(() => {
    logger.log('BasvuruScreen mounted');
    checkTestAccount();
    return () => {
      logger.log('BasvuruScreen unmounted');
    };
  }, []);

  const checkTestAccount = async () => {
    try {
      await testAccountManager.checkAndCleanExpired();
      const account = await testAccountManager.getTestAccount();
      if (account) {
        setTestAccount(account);
        logger.log('Test account found', account);
      }
    } catch (error) {
      logger.error('Error checking test account', error);
    }
  };

  const handleCreateTestAccount = async () => {
    try {
      logger.button('Create Test Account Button', 'clicked');
      const account = await testAccountManager.createTestAccount();
      setTestAccount(account);
      setShowTestAccount(true);
      
      Toast.show({
        type: 'success',
        text1: 'Test Hesabı Oluşturuldu',
        text2: `Tesis Kodu: ${account.tesisKodu}\nPIN: ${account.pin}\n\n1 saat sonra otomatik kapanacak.`
      });
      
      logger.log('Test account created and displayed', account);
    } catch (error) {
      logger.error('Error creating test account', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Test hesabı oluşturulamadı'
      });
    }
  };

  const handleSubmit = async () => {
    try {
      logger.button('Basvuru Submit Button', 'clicked');
      logger.log('Basvuru form submitted', { 
        hasTesisAdi: !!formData.tesisAdi,
        hasTelefon: !!formData.telefon,
        hasEmail: !!formData.email
      });

      // Zorunlu alan kontrolü
      if (!formData.tesisAdi || !formData.yetkiliAdSoyad || !formData.telefon ||
          !formData.email || !formData.il || !formData.ilce || !formData.adres ||
          !formData.odaSayisi || !formData.tesisTuru) {
        logger.warn('Basvuru validation failed - missing fields');
        Toast.show({
          type: 'error',
          text1: 'Eksik Bilgi',
          text2: 'Lütfen zorunlu alanları doldurun'
        });
        return;
      }

      setLoading(true);
      
      // Form verilerini hazırla (odaSayisi'ni number'a çevir)
      const submitData = {
        ...formData,
        odaSayisi: parseInt(formData.odaSayisi, 10) || 0
      };
      
      logger.api('POST', '/auth/basvuru', submitData);
      
      const response = await api.post('/auth/basvuru', submitData);
      
      logger.api('POST', '/auth/basvuru', null, { 
        status: response.status,
        message: response.data.message 
      });
      logger.log('Basvuru submitted successfully');

      Toast.show({
        type: 'success',
        text1: 'Başvuru Alındı',
        text2: response.data.message
      });
      
      Alert.alert(
        'Başvuru Alındı',
        'Başvurunuz alınmıştır. Onaylandığında giriş bilgileriniz WhatsApp ve e-posta ile iletilecektir.',
        [
          {
            text: 'Tamam',
            onPress: () => {
              logger.log('Navigating to Login after basvuru');
              navigation.navigate('Login');
            }
          }
        ]
      );
    } catch (error) {
      logger.error('Basvuru submit error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack
      });
      
      // Network error kontrolü
      if (error.message === 'Network Error' || !error.response) {
        Toast.show({
          type: 'error',
          text1: 'Bağlantı Hatası',
          text2: 'Sunucuya bağlanılamadı. Backend sunucusunun çalıştığından emin olun.'
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Hata',
          text2: error.response?.data?.message || error.message || 'Başvuru gönderilemedi'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <ScrollView style={styles.container}>
        <View style={styles.content}>
        <Text style={styles.title}>Tesis Başvurusu</Text>
        
        {/* Test Hesabı Bölümü */}
        <View style={styles.testAccountSection}>
          <Text style={styles.testAccountTitle}>🧪 Test Hesabı</Text>
          <Text style={styles.testAccountDescription}>
            Test için hızlı bir hesap oluşturun. Bir cihazdan sadece bir kere oluşturulabilir ve 1 saat sonra otomatik kapanır.
          </Text>
          
          {testAccount && showTestAccount ? (
            <View style={styles.testAccountInfo}>
              <Text style={styles.testAccountLabel}>Test Hesap Bilgileri:</Text>
              <Text style={styles.testAccountText}>Tesis Kodu: <Text style={styles.testAccountValue}>{testAccount.tesisKodu}</Text></Text>
              <Text style={styles.testAccountText}>PIN (Şifre): <Text style={styles.testAccountValue}>{testAccount.pin}</Text></Text>
              <Text style={styles.testAccountExpiry}>
                Süre: {new Date(testAccount.expiresAt).toLocaleString('tr-TR')} tarihine kadar geçerli
              </Text>
              <TouchableOpacity
                style={styles.testAccountButton}
                onPress={() => {
                  logger.button('Use Test Account Button', 'clicked');
                  navigation.navigate('Login', { 
                    testAccount: {
                      tesisKodu: testAccount.tesisKodu,
                      pin: testAccount.pin
                    }
                  });
                }}
              >
                <Text style={styles.testAccountButtonText}>Bu Bilgilerle Giriş Yap</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.testAccountButton}
              onPress={handleCreateTestAccount}
            >
              <Text style={styles.testAccountButtonText}>Test Hesabı Oluştur</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Gerçek Başvuru Formu</Text>
        
        <Text style={styles.label}>Tesis Adı *</Text>
        <TextInput
          style={styles.input}
          value={formData.tesisAdi}
          onChangeText={(text) => setFormData({ ...formData, tesisAdi: text })}
        />

        <Text style={styles.label}>Yetkili Ad Soyad *</Text>
        <TextInput
          style={styles.input}
          value={formData.yetkiliAdSoyad}
          onChangeText={(text) => setFormData({ ...formData, yetkiliAdSoyad: text })}
        />

        <Text style={styles.label}>Telefon (WhatsApp) *</Text>
        <TextInput
          style={styles.input}
          value={formData.telefon}
          onChangeText={(text) => setFormData({ ...formData, telefon: text })}
          keyboardType="phone-pad"
        />
        <Text style={styles.hint}>
          Lütfen aktif olarak kullandığınız WhatsApp numaranızı eksiksiz giriniz.
        </Text>

        <Text style={styles.label}>E-posta *</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>İl *</Text>
        <TextInput
          style={styles.input}
          value={formData.il}
          onChangeText={(text) => setFormData({ ...formData, il: text })}
        />

        <Text style={styles.label}>İlçe *</Text>
        <TextInput
          style={styles.input}
          value={formData.ilce}
          onChangeText={(text) => setFormData({ ...formData, ilce: text })}
        />

        <Text style={styles.label}>Açık Adres *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.adres}
          onChangeText={(text) => setFormData({ ...formData, adres: text })}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Toplam Oda Sayısı *</Text>
        <TextInput
          style={styles.input}
          value={formData.odaSayisi}
          onChangeText={(text) => setFormData({ ...formData, odaSayisi: text })}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Tesis Türü *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={formData.tesisTuru}
            onValueChange={(value) => setFormData({ ...formData, tesisTuru: value })}
            style={styles.picker}
          >
            <Picker.Item label="Otel" value="otel" />
            <Picker.Item label="Pansiyon" value="pansiyon" />
            <Picker.Item label="Apart" value="apart" />
            <Picker.Item label="Diğer" value="diger" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Gönderiliyor...' : 'Başvuru Yap'}
          </Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </ErrorBoundary>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333'
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333'
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: -10,
    marginBottom: 15
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd'
  },
  picker: {
    height: 50
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 20
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  testAccountSection: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#90caf9'
  },
  testAccountTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8
  },
  testAccountDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 15
  },
  testAccountInfo: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    marginTop: 10
  },
  testAccountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8
  },
  testAccountText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4
  },
  testAccountValue: {
    fontWeight: 'bold',
    color: '#1976d2'
  },
  testAccountExpiry: {
    fontSize: 11,
    color: '#f57c00',
    marginTop: 8,
    fontStyle: 'italic'
  },
  testAccountButton: {
    backgroundColor: '#1976d2',
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
    marginTop: 10
  },
  testAccountButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 20
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  }
});

