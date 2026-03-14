import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
// expo-camera Expo Go'da çalışmaz, expo-image-picker kullanıyoruz
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';
import { getBackendUrl } from '../services/apiSupabase';
import * as offlineKbs from '../services/offlineKbsDB';
import { showKimlikBildirimInProgress, dismissKimlikBildirimNotification } from '../services/pushNotifications';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useCredits } from '../context/CreditsContext';
import { useAuth } from '../context/AuthContext';
import PermissionCard from '../components/PermissionCard';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import {
  feedbackCheckInSuccess,
  feedbackReadSuccess,
  speakApproachPassport,
  getTtsLocale,
} from '../utils/feedback';
import { useLanguage } from '../context/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FREQUENT_NATIONALITIES } from '../constants/frequentNationalities';
import { getVisaWarningFromDate } from '../utils/visaWarning';

const MIN_BUTTON_SIZE = 60; // Eldivenle kullanım için dev butonlar

export default function CheckInScreen({ navigation, route }) {
  const { triggerPaywall } = useCredits();
  const { tesis } = useAuth();
  const { language } = useLanguage();
  const ttsLocale = getTtsLocale(language);
  const [step, setStep] = useState(1);
  const [odalar, setOdalar] = useState([]);
  const [selectedOda, setSelectedOda] = useState(null);
  const [formData, setFormData] = useState({
    ad: '',
    ad2: '', // baba adı (MRZ/KBS için ayrı, karıştırma)
    anaAdi: '',
    soyad: '',
    kimlikNo: '',
    pasaportNo: '',
    dogumTarihi: '',
    uyruk: 'TÜRK',
    misafirTipi: '' // tc_vatandasi | ykn | yabanci — Jandarma/Polis için
  });
  const [loading, setLoading] = useState(false);
  /** Step 2'de kamera kullanılacaksa izin verilmediyse bu kart gösterilir; Geri ile kapatılır, tekrar Okut'ta çıkar */
  const [showCameraPermissionCard, setShowCameraPermissionCard] = useState(false);
  /** Step 3'te "Sadece kaydet" yapıldıktan sonra gösterilen başarı alanı */
  const [savedOnly, setSavedOnly] = useState(false);
  const [savingOkutulan, setSavingOkutulan] = useState(false);
  /** MRZ/belge bitiş tarihi — vize uyarısı göstermek için */
  const [documentExpiryFromMrz, setDocumentExpiryFromMrz] = useState(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const headerSafeStyle = { paddingTop: insets.top + theme.spacing.lg, paddingBottom: theme.spacing.lg };
  const tcLookupTimeoutRef = useRef(null);
  const tcLookupInProgressRef = useRef(false);

  // TC 11 hane girilince (bu tesiste daha önce check-in yapılmışsa) ad, soyad, doğum tarihi, uyruk otomatik doldurulur
  useEffect(() => {
    const kimlikNo = (formData.kimlikNo || '').replace(/\D/g, '');
    if (kimlikNo.length !== 11) return;
    if (tcLookupInProgressRef.current) return;
    if (tcLookupTimeoutRef.current) clearTimeout(tcLookupTimeoutRef.current);
    const tcToLookup = kimlikNo.slice(0, 11);
    tcLookupTimeoutRef.current = setTimeout(async () => {
      tcLookupTimeoutRef.current = null;
      tcLookupInProgressRef.current = true;
      try {
        const data = await api.get(`/checkin/tc-lookup?tc=${encodeURIComponent(tcToLookup)}`);
        const resolved = data?.data ?? data;
        if (resolved?.found && (resolved.ad || resolved.soyad)) {
          setFormData(prev => {
            const currentTc = (prev.kimlikNo || '').replace(/\D/g, '').slice(0, 11);
            if (currentTc !== tcToLookup) return prev;
            return {
              ...prev,
              ad: (resolved.ad || '').trim() || prev.ad,
              soyad: (resolved.soyad || '').trim() || prev.soyad,
              dogumTarihi: (resolved.dogumTarihi || '').trim() || prev.dogumTarihi,
              uyruk: (resolved.uyruk || 'TÜRK').trim() || prev.uyruk,
            };
          });
          Toast.show({ type: 'success', text1: 'Bilgiler getirildi', text2: 'Daha önce bu TC ile kayıt bulundu.' });
        }
      } catch (e) {
        logger.warn('TC lookup failed', e);
      } finally {
        tcLookupInProgressRef.current = false;
      }
    }, 500);
    return () => {
      if (tcLookupTimeoutRef.current) {
        clearTimeout(tcLookupTimeoutRef.current);
        tcLookupTimeoutRef.current = null;
      }
    };
  }, [formData.kimlikNo]);

  useEffect(() => {
    logger.log('CheckInScreen mounted');
    try {
      loadOdalar();
    } catch (error) {
      logger.error('CheckInScreen initialization error', error);
    }
    return () => {
      logger.log('CheckInScreen unmounted');
    };
  }, []);

  // MRZ veya belge taramasından dönünce formu otomatik doldur, oda seçimini geri yükle
  const [documentPhotoUri, setDocumentPhotoUri] = useState(null);
  useFocusEffect(
    React.useCallback(() => {
      const doc = route.params?.documentPayload;
      if (doc) {
        const odaFromParams = route.params?.selectedOda;
        if (odaFromParams && odaFromParams.id) {
          setSelectedOda(odaFromParams);
        }
        setFormData(prev => ({
          ...prev,
          ad: (doc.ad || '').trim() || prev.ad,
          ad2: (doc.ad2 || doc.babaAdi || '').trim() || prev.ad2,
          anaAdi: (doc.anaAdi || '').trim() || prev.anaAdi,
          soyad: (doc.soyad || '').trim() || prev.soyad,
          kimlikNo: (doc.kimlikNo || '').trim() || prev.kimlikNo,
          pasaportNo: (doc.pasaportNo || '').trim() || prev.pasaportNo,
          dogumTarihi: (doc.dogumTarihi || '').trim() || prev.dogumTarihi,
          uyruk: (doc.uyruk || 'TÜRK').trim() || prev.uyruk,
          misafirTipi: (doc.misafirTipi || '').trim() || prev.misafirTipi,
        }));
        setDocumentExpiryFromMrz(doc.expiryDate ? new Date(doc.expiryDate) : null);
        setDocumentPhotoUri(route.params?.photoUri || null);
        setStep(3);
        feedbackReadSuccess(ttsLocale);
        navigation.setParams({ documentPayload: undefined, photoUri: undefined, selectedOda: undefined });
        return;
      }
      const p = route.params?.mrzPayload;
      if (!p) return;
      const odaFromParams = route.params?.selectedOda;
      if (odaFromParams && odaFromParams.id) {
        setSelectedOda(odaFromParams);
      }
      const isoToDDMMYYYY = (iso) => {
        if (!iso) return '';
        const [y, m, d] = iso.split('-');
        return [d, m, y].filter(Boolean).join('.');
      };
      const givenNames = (p.givenNames || '').trim();
      const nameParts = givenNames ? givenNames.split(/\s+/) : [];
      setFormData(prev => ({
        ...prev,
        ad: (p.ad || nameParts[0] || '').trim(),
        ad2: (p.babaAdi ?? (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '')).trim() || prev.ad2,
        anaAdi: (p.anaAdi ?? '').trim() || prev.anaAdi,
        soyad: (p.surname || '').trim(),
        pasaportNo: (p.passportNumber || '').trim(),
        kimlikNo: /^\d{11}$/.test((p.passportNumber || '').trim()) ? (p.passportNumber || '').trim() : prev.kimlikNo,
        dogumTarihi: isoToDDMMYYYY(p.birthDate) || prev.dogumTarihi,
        uyruk: (p.nationality || 'TÜRK').trim(),
      }));
      setDocumentExpiryFromMrz(p.expiryDate ? new Date(p.expiryDate) : null);
      setDocumentPhotoUri(route.params?.photoUri || null);
      setStep(3);
      feedbackReadSuccess(ttsLocale);
      navigation.setParams({ mrzPayload: undefined, selectedOda: undefined, photoUri: undefined });
    }, [route.params?.mrzPayload, route.params?.documentPayload, route.params?.photoUri, route.params?.selectedOda, navigation])
  );

  const loadOdalar = async () => {
    try {
      logger.log('[CheckInScreen] loadOdalar başladı', { filtre: 'bos' });
      logger.api('GET', '/oda?filtre=bos');
      const response = await api.get('/oda?filtre=bos');
      logger.api('GET', '/oda?filtre=bos', null, {
        status: response.status,
        odaCount: response.data.odalar?.length,
      });
      setOdalar(response.data.odalar ?? []);
      logger.log('[CheckInScreen] Odalar yüklendi', { count: response.data.odalar?.length ?? 0 });
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Odalar yüklenemedi';
      const step = error?.step || error?.response?.data?.step;
      logger.error('[CheckInScreen] loadOdalar hatası', { message: msg, step, status: error?.response?.status }, error);
      Toast.show({
        type: 'error',
        text1: 'Odalar yüklenemedi',
        text2: step ? `${msg} (adım: ${step})` : msg,
        visibilityTime: 5000,
      });
    }
  };

  // Step 2: Sesli yönlendirme — MRZ/kamera ile okutma
  useEffect(() => {
    if (step !== 2) return;
    speakApproachPassport(ttsLocale);
  }, [step, ttsLocale]);

  const handleCameraRead = async () => {
    try {
      logger.log('Camera read started');
      let { status: existing } = await ImagePicker.getCameraPermissionsAsync();
      if (existing !== 'granted') {
        const { status: requested } = await ImagePicker.requestCameraPermissionsAsync();
        if (requested !== 'granted') {
          setShowCameraPermissionCard(true);
          return;
        }
        existing = requested;
      }
      await launchCameraForCheckIn();
    } catch (error) {
      logger.error('Camera check error', error);
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Kamera kontrol edilemedi' });
    }
  };

  const launchCameraForCheckIn = async () => {
    try {
      logger.log('Launching camera');
      // Bazı cihazlarda izin state güncel olmayabiliyor; açmadan hemen önce tekrar iste
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setShowCameraPermissionCard(true);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType?.Images ?? 'images',
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
          setFormData((prev) => ({
            ...prev,
            ...response.data.parsed
          }));
          setStep(3);
          setSavedOnly(false);
          feedbackReadSuccess(ttsLocale);
        } else {
          logger.warn('OCR failed', response.data);
        }
      } else {
        logger.log('Camera canceled by user');
      }
    } catch (error) {
      logger.error('Camera read error', error);
      const msg = error?.message || '';
      const isPermission = /permission|izin|denied|erişim/i.test(msg);
      Toast.show({
        type: 'error',
        text1: 'Kamera açılamadı',
        text2: isPermission
          ? 'Kamera iznini verin veya Ayarlar > İzinler\'den kontrol edin.'
          : 'Fotoğraf çekilemedi. "Hızlı MRZ" veya galeri ile deneyebilirsiniz.',
      });
    }
  };

  const handleOkut = () => {
    try {
      logger.button('Okut Button', 'clicked');
      logger.log('Okut button pressed', { step });
      handleCameraRead();
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
    let kimlikNotifId = null;
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
      const misafirData = {
        ad: formData.ad,
        soyad: formData.soyad,
        kimlikNo: formData.kimlikNo || undefined,
        pasaportNo: formData.pasaportNo || undefined,
        dogumTarihi: formData.dogumTarihi,
        uyruk: formData.uyruk || 'TÜRK',
        room_number: selectedOda.odaNumarasi
      };
      const odaNo = selectedOda.odaNumarasi;
      const branchId = tesis?.id || 'local';

      let localId = null;
      try {
        localId = await offlineKbs.saveToQueue(misafirData, odaNo, branchId);
      } catch (queueErr) {
        logger.warn('Offline queue save failed', queueErr);
      }

      try {
        kimlikNotifId = await showKimlikBildirimInProgress();
      } catch (_) {}
      const payload = {
        odaId: selectedOda.id,
        room_number: odaNo,
        ad: formData.ad,
        ad2: formData.ad2 || undefined,
        anaAdi: formData.anaAdi || undefined,
        soyad: formData.soyad,
        kimlikNo: formData.kimlikNo || undefined,
        pasaportNo: formData.pasaportNo || undefined,
        dogumTarihi: formData.dogumTarihi,
        uyruk: formData.uyruk,
        misafirTipi: formData.misafirTipi || undefined
      };

      const useBackendCheckin = !!getBackendUrl();
      const apiPath = useBackendCheckin ? '/checkin' : '/misafir/checkin';
      const checkinPayload = useBackendCheckin
        ? { ad: formData.ad, soyad: formData.soyad, kimlikNo: formData.kimlikNo, pasaportNo: formData.pasaportNo, dogumTarihi: formData.dogumTarihi, uyruk: formData.uyruk || 'TÜRK', room_number: odaNo }
        : payload;

      logger.api('POST', apiPath, checkinPayload);
      const response = await api.post(apiPath, checkinPayload);

      if (localId) await offlineKbs.deleteFromQueue(localId).catch(() => {});

      logger.api('POST', apiPath, null, { status: response.status, message: response.data?.message });
      logger.log('CheckIn successful');
      feedbackCheckInSuccess(ttsLocale);

      Toast.show({
        type: 'success',
        text1: 'Başarılı',
        text2: response.data?.message || 'Check-in kaydedildi'
      });

      navigation.navigate('Main', { screen: 'Misafirler' });
    } catch (error) {
      logger.error('CheckIn error', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.message || 'Check-in başarısız';
      if (status === 402) {
        triggerPaywall(error.response?.data?.code || 'no_credits');
        Toast.show({ type: 'info', text1: 'Bildirim hakkı doldu', text2: msg });
      } else {
        Toast.show({
          type: 'error',
          text1: status === 401 ? 'Oturum süresi dolmuş olabilir' : 'Hata',
          text2: status === 401 ? 'Tekrar giriş yapın.' : (msg + (localId ? ' Kayıt bekleyecek, internet gelince gönderilecek.' : ''))
        });
      }
    } finally {
      if (typeof kimlikNotifId === 'string') {
        dismissKimlikBildirimNotification(kimlikNotifId).catch(() => {});
      }
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        
        {/* Header */}
        <View style={[styles.header, headerSafeStyle]}>
          <TouchableOpacity
            style={[styles.backButton, styles.backButtonLeft, { minWidth: MIN_BUTTON_SIZE, minHeight: MIN_BUTTON_SIZE }]}
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
              Check-in yapmak için aşağıdan bir oda seçin
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
        <View style={[styles.header, headerSafeStyle]}>
          <TouchableOpacity
            style={[styles.backButton, styles.backButtonLeft]}
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
              {selectedOda && `Oda ${selectedOda.odaNumarasi} için kimlik veya pasaport okutun`}
            </Text>
          </View>

          {showCameraPermissionCard && (
            <PermissionCard
              icon="camera-outline"
              title="Kamera izni gerekli"
              description="Kimlik fotoğrafı çekmek için kamera erişimine izin verin. İstemezseniz aşağıdan manuel giriş yapabilirsiniz."
              onAllow={async () => {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                setShowCameraPermissionCard(false);
                if (status === 'granted') await launchCameraForCheckIn();
                else Toast.show({ type: 'info', text1: 'İzin verilmedi', text2: 'Tekrar "İzin ver" ile deneyebilirsiniz.' });
              }}
              onDismiss={() => setShowCameraPermissionCard(false)}
              dismissLabel="Geri"
            />
          )}

          <View style={styles.readerContainer}>
            <View style={styles.readerTopBlock}>
              <View style={styles.readerIconContainer}>
                <View style={[styles.readerIcon, { backgroundColor: theme.colors.secondary + '15' }]}>
                  <Ionicons name="camera" size={80} color={theme.colors.secondary} />
                </View>
              </View>

              <Text style={styles.readerTitle}>Kamera ile Okut</Text>

              <Text style={styles.readerDescription}>
                Kimliğinizin ön yüzünün fotoğrafını çekin veya MRZ için "MRZ Tara" sekmesine gidin.
              </Text>

              <TouchableOpacity 
                style={[styles.okutButton, styles.okutButtonCamera, { minHeight: MIN_BUTTON_SIZE }]}
                onPress={handleOkut}
              >
                <Ionicons 
                  name="camera" 
                  size={24} 
                  color={theme.colors.white} 
                  style={styles.okutButtonIcon}
                />
                <Text style={styles.okutButtonText}>Kamera ile Okut</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.readerSpacer} />

            <TouchableOpacity
              style={[styles.manualButton, { minHeight: MIN_BUTTON_SIZE }]}
              onPress={() => {
                try {
                  logger.button('Manuel Giriş Button', 'clicked');
                  logger.log('Manual entry selected');
                  setStep(4); // Manuel giriş doğrudan forma gider
                } catch (error) {
                  logger.error('Manual entry error', error);
                }
              }}
            >
              <Ionicons name="create-outline" size={20} color={theme.colors.primary} style={styles.manualButtonIcon} />
              <Text style={styles.manualButtonText}>Manuel Giriş Yap</Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
  }

  // Step 3: İki sistem — Check-in'e gönder veya Sadece kaydet
  const handleSadeceKaydet = async () => {
    if (!formData.ad?.trim() || !formData.soyad?.trim()) {
      Toast.show({ type: 'error', text1: 'Eksik bilgi', text2: 'Ad ve soyad gerekli.' });
      return;
    }
    const num = (formData.kimlikNo || formData.pasaportNo || '').trim();
    const isTc = /^\d{11}$/.test(num);
    const body = {
      belgeTuru: isTc ? 'kimlik' : 'pasaport',
      ad: formData.ad.trim(),
      soyad: formData.soyad.trim(),
      kimlikNo: isTc ? num : null,
      pasaportNo: !isTc ? num : null,
      belgeNo: num || null,
      dogumTarihi: (formData.dogumTarihi || '').trim() || null,
      uyruk: (formData.uyruk || 'TÜRK').trim(),
    };
    setSavingOkutulan(true);
    try {
      await api.post('/okutulan-belgeler', body);
      setSavedOnly(true);
      Toast.show({ type: 'success', text1: 'Kaydedildi', text2: 'Kaydedilenler sayfasından görüntüleyebilirsiniz.' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: e?.response?.data?.message || 'Tekrar deneyin.' });
    } finally {
      setSavingOkutulan(false);
    }
  };

  if (step === 3) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
        <View style={[styles.header, headerSafeStyle]}>
          <TouchableOpacity style={[styles.backButton, styles.backButtonLeft]} onPress={() => setStep(2)}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ne yapmak istiyorsunuz?</Text>
          <View style={styles.headerPlaceholder} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="bed-outline" size={20} color={theme.colors.primary} /> Oda seçimi
            </Text>
            <Text style={styles.sectionSubtitle}>
              {selectedOda ? `Oda ${selectedOda.odaNumarasi} seçili` : 'Oda seçilmedi'}
            </Text>
            <TouchableOpacity
              style={[styles.odaChangeButton, { minHeight: MIN_BUTTON_SIZE }]}
              onPress={() => setStep(1)}
              activeOpacity={0.8}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.odaChangeButtonText}>{selectedOda ? 'Oda değiştir' : 'Oda seç'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="id-card-outline" size={20} color={theme.colors.primary} /> Okunan kimlik
            </Text>
            <Text style={styles.sectionSubtitle}>
              {formData.ad} {formData.soyad}
              {(formData.kimlikNo || formData.pasaportNo) && ` · ${(formData.kimlikNo || formData.pasaportNo).slice(0, 4)}****`}
            </Text>
            <Text style={styles.sectionHint}>
              Okuma optik MRZ ile yapıldı; özellikle ad, soyad ve numaraları kontrol edin.
            </Text>
          </View>

          {savedOnly ? (
            <View style={[styles.formCard, styles.successCard]}>
              <View style={styles.successIconWrap}>
                <Ionicons name="checkmark-circle" size={48} color={theme.colors.success || '#22c55e'} />
              </View>
              <Text style={styles.successTitle}>Kaydedildi</Text>
              <Text style={styles.successSubtitle}>Bu kimlik kaydedilenler listesine eklendi.</Text>
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.tekrarDeneButton]}
                onPress={() => { setSavedOnly(false); setStep(2); }}
                activeOpacity={0.8}
              >
                <Ionicons name="scan-outline" size={22} color={theme.colors.primary} />
                <Text style={styles.primaryActionButtonText}>Tekrar oku</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryActionButton]}
                onPress={() => navigation.navigate('Kaydedilenler')}
                activeOpacity={0.8}
              >
                <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
                <Text style={styles.secondaryActionButtonText}>Kaydedilenler sayfasına git</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryActionButton, styles.sendActionButton, { minHeight: MIN_BUTTON_SIZE }]}
                onPress={() => setStep(4)}
                activeOpacity={0.8}
              >
                <Ionicons name="paper-plane-outline" size={22} color="#fff" />
                <Text style={[styles.primaryActionButtonText, { color: '#fff' }]}>Check-in'e gönder</Text>
              </TouchableOpacity>
              <Text style={styles.choiceHint}>Oda seçip bilgileri onaylayarak KBS'ye gönderin. İsterseniz toplu okutup aynı odaya hepsini gönderebilirsiniz.</Text>
              <TouchableOpacity
                style={[styles.secondaryActionButton, styles.saveOnlyButton]}
                onPress={handleSadeceKaydet}
                disabled={savingOkutulan}
                activeOpacity={0.8}
              >
                {savingOkutulan ? (
                  <Text style={styles.secondaryActionButtonText}>Kaydediliyor...</Text>
                ) : (
                  <>
                    <Ionicons name="bookmark-outline" size={20} color={theme.colors.primary} />
                    <Text style={styles.secondaryActionButtonText}>Sadece kaydet</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.choiceHint}>Kimliği sadece kaydeder; check-in veya KBS gönderimi yapılmaz. Kaydedilenler sayfasından görüntüleyebilirsiniz.</Text>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />
      
      {/* Header */}
      <View style={[styles.header, headerSafeStyle]}>
        <TouchableOpacity
          style={[styles.backButton, styles.backButtonLeft]}
          onPress={() => setStep(3)}
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

        {documentPhotoUri ? (
          <View style={styles.documentPhotoWrap}>
            <Image source={{ uri: documentPhotoUri }} style={styles.documentPhoto} resizeMode="cover" />
            <Text style={styles.documentPhotoLabel}>Belge ön yüz</Text>
          </View>
        ) : null}

        {/* Kimlik okunduğunda tüm bilgiler şeffaf arka planda (Jandarma/Polis’e gidecek alanlar) */}
        <View style={styles.transparentInfoCard}>
          <Text style={styles.transparentInfoTitle}>Okunan Kimlik Bilgileri (KBS’e gidecek)</Text>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>1. Ad</Text>
            <Text style={styles.transparentInfoValue}>{formData.ad || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Baba adı</Text>
            <Text style={styles.transparentInfoValue}>{formData.ad2 || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Ana adı</Text>
            <Text style={styles.transparentInfoValue}>{formData.anaAdi || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Soyad</Text>
            <Text style={styles.transparentInfoValue}>{formData.soyad || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>T.C. Kimlik No</Text>
            <Text style={styles.transparentInfoValue}>{formData.kimlikNo || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Pasaport No</Text>
            <Text style={styles.transparentInfoValue}>{formData.pasaportNo || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Doğum Tarihi</Text>
            <Text style={styles.transparentInfoValue}>{formData.dogumTarihi || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Ülke / Uyruk</Text>
            <Text style={styles.transparentInfoValue}>{formData.uyruk || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Oda No</Text>
            <Text style={styles.transparentInfoValue}>{selectedOda?.odaNumarasi || '—'}</Text>
          </View>
          <View style={styles.transparentInfoRow}>
            <Text style={styles.transparentInfoLabel}>Misafir tipi (KBS)</Text>
            <Text style={styles.transparentInfoValue}>
              {formData.misafirTipi === 'tc_vatandasi' ? 'T.C. Vatandaşı' : formData.misafirTipi === 'ykn' ? 'YKN' : formData.misafirTipi === 'yabanci' ? 'Yabancı' : '—'}
            </Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /> 1. Ad *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="İlk ad"
              placeholderTextColor={theme.colors.textDisabled}
              value={formData.ad}
              onChangeText={(text) => setFormData({ ...formData, ad: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /> Baba adı
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Baba adı (MRZ’den gelir)"
              placeholderTextColor={theme.colors.textDisabled}
              value={formData.ad2}
              onChangeText={(text) => setFormData({ ...formData, ad2: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /> Ana adı
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ana adı (MRZ’den gelir)"
              placeholderTextColor={theme.colors.textDisabled}
              value={formData.anaAdi}
              onChangeText={(text) => setFormData({ ...formData, anaAdi: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="person-outline" size={16} color={theme.colors.textSecondary} /> Soyad *
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Soyad"
              placeholderTextColor={theme.colors.textDisabled}
              value={formData.soyad}
              onChangeText={(text) => setFormData({ ...formData, soyad: text })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.textSecondary} /> Misafir tipi (Jandarma/Polis)
            </Text>
            <View style={styles.misafirTipiRow}>
              {[
                { value: 'tc_vatandasi', label: 'T.C. Vatandaşı' },
                { value: 'ykn', label: 'YKN' },
                { value: 'yabanci', label: 'Yabancı' }
              ].map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.misafirTipiBtn,
                    formData.misafirTipi === value && styles.misafirTipiBtnActive
                  ]}
                  onPress={() => setFormData({ ...formData, misafirTipi: value })}
                >
                  <Text style={[
                    styles.misafirTipiBtnText,
                    formData.misafirTipi === value && styles.misafirTipiBtnTextActive
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: theme.spacing.base }]}>
              <Text style={styles.inputLabel}>
                <Ionicons name="id-card-outline" size={16} color={theme.colors.textSecondary} /> T.C. Kimlik No
              </Text>
              <TextInput
                style={styles.input}
                placeholder="11 haneli — yazınca kayıtlıysa otomatik doldurulur"
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.frequentNationalityScroll} contentContainerStyle={styles.frequentNationalityChips}>
                {FREQUENT_NATIONALITIES.map((n) => {
                  const selected = formData.uyruk === n.label || formData.uyruk === n.code;
                  return (
                    <TouchableOpacity
                      key={n.code}
                      style={[
                        styles.frequentNationalityChip,
                        { backgroundColor: selected ? theme.colors.primary + '25' : theme.colors.surface, borderColor: theme.colors.border },
                      ]}
                      onPress={() => setFormData({ ...formData, uyruk: n.label })}
                    >
                      <Text style={[styles.frequentNationalityChipText, { color: selected ? theme.colors.primary : theme.colors.textPrimary }]}>{n.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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
            style={[styles.submitButton, loading && styles.submitButtonDisabled, { minHeight: MIN_BUTTON_SIZE }]}
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
  visaWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.base,
    borderRadius: theme.spacing.borderRadius.base,
    borderWidth: 1,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  visaWarningText: { fontSize: theme.typography.fontSize.sm, fontWeight: '500', flex: 1 },
  frequentNationalityScroll: { marginBottom: theme.spacing.sm, maxHeight: 44 },
  frequentNationalityChips: { flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: 4 },
  frequentNationalityChip: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.spacing.borderRadius.full,
    borderWidth: 1,
  },
  frequentNationalityChipText: { fontSize: theme.typography.fontSize.sm, fontWeight: '500' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonRight: {
    marginRight: 0,
  },
  backButtonLeft: {
    marginLeft: 0,
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
    flexGrow: 1,
  },
  section: {
    flex: 1,
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
  sectionHint: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  odaChangeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius?.button ?? 12,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '12',
  },
  odaChangeButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary,
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
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  readerTopBlock: {
    alignItems: 'center',
  },
  readerSpacer: {
    flex: 1,
    minHeight: 24,
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
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.base,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '18',
  },
  manualButtonIcon: {
    marginRight: theme.spacing.sm,
  },
  manualButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
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
  nfcListeningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.spacing.borderRadius.base,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  nfcListeningText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '600',
  },
  nfcProgressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  nfcProgressText: {
    fontSize: 14,
    flex: 1,
  },
  documentPhotoWrap: {
    alignSelf: 'center',
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  documentPhoto: {
    width: 100,
    height: 125,
    borderRadius: theme.spacing.borderRadius.base,
    backgroundColor: theme.colors.gray100,
  },
  documentPhotoLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  transparentInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  transparentInfoTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.base,
  },
  transparentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  transparentInfoLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  transparentInfoValue: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  misafirTipiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  misafirTipiBtn: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    borderRadius: theme.spacing.borderRadius.base,
    backgroundColor: theme.colors.gray100,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  misafirTipiBtnActive: {
    backgroundColor: theme.colors.primary + '20',
    borderColor: theme.colors.primary,
  },
  misafirTipiBtnText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  misafirTipiBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.typography.fontWeight.semibold,
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
  // Step 3 (seçim / kaydedildi)
  successCard: { alignItems: 'center', paddingVertical: theme.spacing['2xl'] },
  successIconWrap: { marginBottom: theme.spacing.base },
  successTitle: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
  successSubtitle: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, marginBottom: theme.spacing.xl },
  primaryActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.lg, paddingHorizontal: theme.spacing.xl, borderRadius: theme.spacing.borderRadius.lg, width: '100%', marginBottom: theme.spacing.base, ...theme.spacing.shadow?.base || {} },
  primaryActionButtonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold },
  tekrarDeneButton: { backgroundColor: theme.colors.primary + '18', borderWidth: 2, borderColor: theme.colors.primary },
  sendActionButton: { backgroundColor: theme.colors.primary },
  secondaryActionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.base, paddingHorizontal: theme.spacing.lg, borderRadius: theme.spacing.borderRadius.base, width: '100%', marginBottom: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  secondaryActionButtonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.medium, color: theme.colors.primary },
  saveOnlyButton: { marginTop: theme.spacing.lg },
  choiceHint: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.base },
});

