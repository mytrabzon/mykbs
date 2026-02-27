import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Image
} from 'react-native';
// expo-camera Expo Go'da çalışmaz, expo-image-picker kullanıyoruz
import * as ImagePicker from 'expo-image-picker';
import NfcManager from 'react-native-nfc-manager';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme';

export default function CheckInScreen({ navigation, route }) {
  const [step, setStep] = useState(1);
  const [odalar, setOdalar] = useState([]);
  const [selectedOda, setSelectedOda] = useState(null);
  const [formData, setFormData] = useState({
    ad: '',
    soyad: '',
    kimlikNo: '',
    pasaportNo: '',
    dogumTarihi: '',
    uyruk: 'TÜRK'
  });
  const [nfcSupported, setNfcSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    logger.log('CheckInScreen mounted');
    try {
      checkNFC();
      loadOdalar();
    } catch (error) {
      logger.error('CheckInScreen initialization error', error);
    }
    return () => {
      logger.log('CheckInScreen unmounted');
    };
  }, []);

  const checkNFC = async () => {
    try {
      logger.log('Checking NFC support');
      
      // Expo Go'da NFC desteklenmez, development build gerektirir
      // Bu yüzden hata yakalayıp kullanıcıya bilgi veriyoruz
      let supported = false;
      try {
        supported = await NfcManager.isSupported();
        logger.log('NFC support check result', { supported });
        
        if (supported) {
          await NfcManager.start();
          logger.log('NFC Manager started');
        }
      } catch (nfcError) {
        logger.warn('NFC check failed (expected in Expo Go)', nfcError.message);
        supported = false;
      }
      
      setNfcSupported(supported);
      
      // NFC desteklenmiyorsa kullanıcıya bilgi ver
      if (!supported) {
        logger.log('NFC not supported, camera will be used instead');
      }
    } catch (error) {
      logger.error('NFC check error', error);
      setNfcSupported(false);
    }
  };

  const loadOdalar = async () => {
    try {
      logger.log('Loading odalar');
      logger.api('GET', '/oda?filtre=bos');
      const response = await api.get('/oda?filtre=bos');
      logger.api('GET', '/oda?filtre=bos', null, { 
        status: response.status,
        odaCount: response.data.odalar?.length 
      });
      setOdalar(response.data.odalar);
      logger.log('Odalar loaded', { count: response.data.odalar?.length });
    } catch (error) {
      logger.error('Load odalar error', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Odalar yüklenemedi'
      });
    }
  };

  const handleNFCRead = async () => {
    try {
      logger.log('NFC read started');
      await NfcManager.requestTechnology(NfcManager.NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      logger.log('NFC tag read', { tagId: tag?.id });
      
      // NFC verisini parse et ve API'ye gönder
      logger.api('POST', '/nfc/okut', { nfcData: tag });
      const response = await api.post('/nfc/okut', {
        nfcData: tag
      });

      logger.api('POST', '/nfc/okut', null, { 
        status: response.status,
        success: response.data.success 
      });

      if (response.data.success) {
        logger.log('NFC read successful, updating form data');
        setFormData({
          ...formData,
          ...response.data.parsed
        });
        setStep(3); // Bilgi onay ekranına geç
      } else {
        logger.warn('NFC read failed', response.data);
      }
    } catch (error) {
      logger.error('NFC read error', error);
      Toast.show({
        type: 'error',
        text1: 'NFC Hatası',
        text2: 'Kimlik okunamadı'
      });
    } finally {
      NfcManager.cancelTechnologyRequest();
      logger.log('NFC technology request cancelled');
    }
  };

  const handleCameraRead = async () => {
    try {
      logger.log('Camera read started');
      // Kamera izni iste
      logger.log('Requesting camera permission');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      logger.log('Camera permission status', { status });
      
      if (status !== 'granted') {
        logger.warn('Camera permission denied');
        Alert.alert('İzin Gerekli', 'Kamera izni gerekli');
        return;
      }

      // Fotoğraf çek
      logger.log('Launching camera');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      logger.log('Camera result', { canceled: result.canceled, hasAsset: !!result.assets?.[0] });

      if (!result.canceled && result.assets[0]) {
        logger.log('Photo taken, sending to OCR API');
        // Fotoğrafı API'ye gönder ve OCR yap
        const formData = new FormData();
        formData.append('image', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'kimlik.jpg',
        });

        logger.api('POST', '/ocr/okut', { image: 'FormData' });
        const response = await api.post('/ocr/okut', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        logger.api('POST', '/ocr/okut', null, { 
          status: response.status,
          success: response.data.success 
        });

        if (response.data.success) {
          logger.log('OCR successful, updating form data');
          setFormData({
            ...formData,
            ...response.data.parsed
          });
          setStep(3); // Bilgi onay ekranına geç
        } else {
          logger.warn('OCR failed', response.data);
        }
      } else {
        logger.log('Camera canceled by user');
      }
    } catch (error) {
      logger.error('Camera read error', error);
      Toast.show({
        type: 'error',
        text1: 'Kamera Hatası',
        text2: 'Fotoğraf çekilemedi'
      });
    }
  };

  const handleOkut = () => {
    try {
      logger.button('Okut Button', 'clicked');
      logger.log('Okut button pressed', { nfcSupported, step });
      if (nfcSupported) {
        logger.log('NFC supported, calling handleNFCRead');
        handleNFCRead();
      } else {
        logger.log('NFC not supported, calling handleCameraRead');
        handleCameraRead();
      }
    } catch (error) {
      logger.error('handleOkut error', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Okuma işlemi başlatılamadı'
      });
    }
  };

  const handleCheckIn = async () => {
    try {
      logger.button('CheckIn Button', 'clicked');
      logger.log('CheckIn initiated', { 
        odaId: selectedOda?.id,
        hasAd: !!formData.ad,
        hasSoyad: !!formData.soyad,
        hasKimlikNo: !!formData.kimlikNo,
        hasPasaportNo: !!formData.pasaportNo
      });

      if (!selectedOda || !formData.ad || !formData.soyad) {
        logger.warn('CheckIn validation failed - missing fields');
        Toast.show({
          type: 'error',
          text1: 'Eksik Bilgi',
          text2: 'Lütfen tüm alanları doldurun'
        });
        return;
      }

      if (!formData.kimlikNo && !formData.pasaportNo) {
        logger.warn('CheckIn validation failed - missing ID');
        Toast.show({
          type: 'error',
          text1: 'Eksik Bilgi',
          text2: 'Kimlik veya pasaport numarası gerekli'
        });
        return;
      }

      setLoading(true);
      const payload = { odaId: selectedOda.id, room_number: selectedOda.odaNumarasi, ...formData };
      logger.api('POST', '/misafir/checkin', payload);
      
      const response = await api.post('/misafir/checkin', payload);

      logger.api('POST', '/misafir/checkin', null, { 
        status: response.status,
        message: response.data.message 
      });
      logger.log('CheckIn successful');

      Toast.show({
        type: 'success',
        text1: 'Başarılı',
        text2: response.data.message
      });

      navigation.goBack();
    } catch (error) {
      logger.error('CheckIn error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.message || 'Check-in başarısız';
      Toast.show({
        type: 'error',
        text1: status === 401 ? 'Giriş gerekli' : 'Hata',
        text2: status === 401 ? 'Tekrar giriş yapın.' : msg
      });
      // Hata durumunda lobiye/geri gitmiyoruz; kullanıcı ekranda kalır.
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Oda Seçimi</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="bed-outline" size={20} color={theme.colors.primary} /> Boş Odalar
            </Text>
            <Text style={styles.sectionSubtitle}>
              Check-in yapmak için bir oda seçin
            </Text>
          </View>

          {odalar.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="hotel" size={80} color={theme.colors.gray300} />
              <Text style={styles.emptyTitle}>Boş Oda Bulunamadı</Text>
              <Text style={styles.emptyText}>
                Tüm odalar dolu veya henüz oda eklenmemiş
              </Text>
            </View>
          ) : (
            <View style={styles.odaGrid}>
              {odalar.map((oda) => (
                <TouchableOpacity
                  key={oda.id}
                  style={[
                    styles.odaCard,
                    selectedOda?.id === oda.id && styles.odaCardSelected
                  ]}
                  onPress={() => {
                    try {
                      logger.button('Oda Select Button', 'clicked');
                      logger.log('Oda selected', { odaId: oda.id, odaNumarasi: oda.odaNumarasi });
                      setSelectedOda(oda);
                      setStep(2);
                    } catch (error) {
                      logger.error('Oda selection error', error);
                    }
                  }}
                >
                  <View style={styles.odaCardHeader}>
                    <View style={styles.odaNumberContainer}>
                      <Text style={styles.odaNumber}>Oda {oda.odaNumarasi}</Text>
                    </View>
                    <View style={[styles.odaStatus, { backgroundColor: theme.colors.success + '15' }]}>
                      <Ionicons name="bed-outline" size={14} color={theme.colors.success} />
                      <Text style={[styles.odaStatusText, { color: theme.colors.success }]}>Boş</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.odaType}>{oda.odaTipi}</Text>
                  
                  <View style={styles.odaDetails}>
                    <View style={styles.odaDetail}>
                      <Ionicons name="people-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.odaDetailText}>{oda.kapasite} Kişi</Text>
                    </View>
                    <View style={styles.odaDetail}>
                      <Ionicons name="pricetag-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={styles.odaDetailText}>₺{oda.fiyat || '0'}/gece</Text>
                    </View>
                  </View>
                  
                  <View style={styles.selectIndicator}>
                    {selectedOda?.id === oda.id ? (
                      <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
                    ) : (
                      <Ionicons name="radio-button-off" size={24} color={theme.colors.gray400} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  if (step === 2) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(1)}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kimlik Okuma</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="id-card-outline" size={20} color={theme.colors.primary} /> Kimlik Bilgileri
            </Text>
            <Text style={styles.sectionSubtitle}>
              {selectedOda && `Oda ${selectedOda.odaNumarasi} için kimlik okutun`}
            </Text>
          </View>

          <View style={styles.readerContainer}>
            <View style={styles.readerIconContainer}>
              {nfcSupported ? (
                <View style={[styles.readerIcon, { backgroundColor: theme.colors.primary + '15' }]}>
                  <Ionicons name="nfc" size={80} color={theme.colors.primary} />
                </View>
              ) : (
                <View style={[styles.readerIcon, { backgroundColor: theme.colors.secondary + '15' }]}>
                  <Ionicons name="camera" size={80} color={theme.colors.secondary} />
                </View>
              )}
            </View>

            <Text style={styles.readerTitle}>
              {nfcSupported ? 'NFC ile Okut' : 'Kamera ile Okut'}
            </Text>
            
            <Text style={styles.readerDescription}>
              {nfcSupported
                ? 'Kimliğinizi telefonun arka kısmına yaklaştırın'
                : 'Kimliğinizin ön yüzünün fotoğrafını çekin'}
            </Text>

            <TouchableOpacity 
              style={[styles.okutButton, nfcSupported ? styles.okutButtonNFC : styles.okutButtonCamera]}
              onPress={handleOkut}
            >
              <Ionicons 
                name={nfcSupported ? "nfc" : "camera"} 
                size={24} 
                color={theme.colors.white} 
                style={styles.okutButtonIcon}
              />
              <Text style={styles.okutButtonText}>
                {nfcSupported ? 'NFC ile Okut' : 'Kamera ile Okut'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualButton}
              onPress={() => {
                try {
                  logger.button('Manuel Giriş Button', 'clicked');
                  logger.log('Manual entry selected');
                  setStep(3);
                } catch (error) {
                  logger.error('Manual entry error', error);
                }
              }}
            >
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} style={styles.manualButtonIcon} />
              <Text style={styles.manualButtonText}>Manuel Giriş Yap</Text>
            </TouchableOpacity>

            {!nfcSupported && (
              <View style={styles.nfcInfo}>
                <Ionicons name="information-circle-outline" size={16} color={theme.colors.warning} />
                <Text style={styles.nfcInfoText}>
                  NFC desteği için development build gereklidir. Şu anda kamera kullanılıyor.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep(2)}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bilgi Onayı</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.primary} /> Misafir Bilgileri
          </Text>
          <Text style={styles.sectionSubtitle}>
            {selectedOda && `Oda ${selectedOda.odaNumarasi} için bilgileri kontrol edin`}
          </Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /> Ad *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Misafir adı"
              placeholderTextColor={theme.colors.textDisabled}
              value={formData.ad}
              onChangeText={(text) => setFormData({ ...formData, ad: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /> Soyad *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Misafir soyadı"
              placeholderTextColor={theme.colors.textDisabled}
              value={formData.soyad}
              onChangeText={(text) => setFormData({ ...formData, soyad: text })}
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: theme.spacing.base }]}>
              <Text style={styles.inputLabel}>
                <Ionicons name="id-card-outline" size={16} color={theme.colors.textSecondary} /> T.C. Kimlik No
              </Text>
              <TextInput
                style={styles.input}
                placeholder="11 haneli"
                placeholderTextColor={theme.colors.textDisabled}
                value={formData.kimlikNo}
                onChangeText={(text) => setFormData({ ...formData, kimlikNo: text })}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>
                <Ionicons name="passport-outline" size={16} color={theme.colors.textSecondary} /> Pasaport No
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Pasaport numarası"
                placeholderTextColor={theme.colors.textDisabled}
                value={formData.pasaportNo}
                onChangeText={(text) => setFormData({ ...formData, pasaportNo: text })}
              />
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: theme.spacing.base }]}>
              <Text style={styles.inputLabel}>
                <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} /> Doğum Tarihi
              </Text>
              <TextInput
                style={styles.input}
                placeholder="DD.MM.YYYY"
                placeholderTextColor={theme.colors.textDisabled}
                value={formData.dogumTarihi}
                onChangeText={(text) => setFormData({ ...formData, dogumTarihi: text })}
              />
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>
                <Ionicons name="flag-outline" size={16} color={theme.colors.textSecondary} /> Uyruk
              </Text>
              <TextInput
                style={styles.input}
                placeholder="TÜRK"
                placeholderTextColor={theme.colors.textDisabled}
                value={formData.uyruk}
                onChangeText={(text) => setFormData({ ...formData, uyruk: text })}
              />
            </View>
          </View>

          <View style={styles.requiredInfo}>
            <Ionicons name="information-circle-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.requiredInfoText}>
              * İşaretli alanlar zorunludur. Kimlik veya pasaport numarasından en az biri gereklidir.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleCheckIn}
            disabled={loading || !formData.ad || !formData.soyad || (!formData.kimlikNo && !formData.pasaportNo)}
          >
            {loading ? (
              <Text style={styles.submitButtonText}>Kaydediliyor...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} style={styles.submitButtonIcon} />
                <Text style={styles.submitButtonText}>Onayla ve Check-in Yap</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
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
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.screenPadding,
    paddingBottom: theme.spacing['4xl'],
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  odaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.base,
  },
  odaCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.spacing.shadow.base,
  },
  odaCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '05',
  },
  odaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  odaNumberContainer: {
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.spacing.borderRadius.full,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.xs,
  },
  odaNumber: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  odaStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.spacing.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  odaStatusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  odaType: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  odaDetails: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.base,
  },
  odaDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  odaDetailText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  selectIndicator: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  readerContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  readerIconContainer: {
    marginBottom: theme.spacing.xl,
  },
  readerIcon: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readerTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  readerDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing['2xl'],
  },
  okutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 300,
    ...theme.spacing.shadow.base,
  },
  okutButtonNFC: {
    backgroundColor: theme.colors.primary,
  },
  okutButtonCamera: {
    backgroundColor: theme.colors.secondary,
  },
  okutButtonIcon: {
    marginRight: theme.spacing.sm,
  },
  okutButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xl,
    padding: theme.spacing.base,
  },
  manualButtonIcon: {
    marginRight: theme.spacing.sm,
  },
  manualButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary,
  },
  nfcInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning + '15',
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  nfcInfoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.warningDark,
    flex: 1,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.xl,
    ...theme.spacing.shadow.base,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  rowInputs: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  requiredInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  requiredInfoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    flex: 1,
    lineHeight: theme.typography.lineHeight.normal,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    ...theme.spacing.shadow.base,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonIcon: {
    marginRight: theme.spacing.sm,
  },
  submitButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
});

