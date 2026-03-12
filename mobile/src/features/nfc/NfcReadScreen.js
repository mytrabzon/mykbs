/**
 * Ayrı NFC okuma ekranı — MRZ kameradan bağımsız.
 * Ayarlardan NFC açıkken ana ekrandaki "NFC Oku" ile bu ekrana gelinir.
 */
import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { useIndependentNfcReader } from './IndependentNfcReader';
import { logger } from '../../utils/logger';

export default function NfcReadScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const {
    readNfcDirect,
    isReading,
    progress,
    isSupported,
  } = useIndependentNfcReader();

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const goToMrz = useCallback(() => {
    navigation.replace('MrzScan');
  }, [navigation]);

  useEffect(() => {
    if (!isSupported) {
      Toast.show({ type: 'info', text1: 'NFC desteklenmiyor', text2: 'Bu cihazda NFC çipi okunamıyor.' });
    }
  }, [isSupported]);

  const handleRead = useCallback(async () => {
    if (!isSupported) {
      logger.info('[NFC] Okuma başlatılamadı: desteklenmiyor');
      Toast.show({ type: 'info', text1: 'NFC desteklenmiyor', text2: 'MRZ kamerayı kullanın.' });
      return;
    }
    logger.info('[NFC] Okuma başlatıldı (NFC ile oku butonu)');
    try {
      const result = await readNfcDirect();
      logger.info('[NFC] readNfcDirect sonucu', { success: result?.success, hasData: !!result?.data, error: result?.error });
      if (result?.success && result?.data) {
        const d = result.data;
        logger.info('[NFC] Okuma başarılı', { ad: d.ad, soyad: d.soyad, kimlikNo: d.kimlikNo, pasaportNo: d.pasaportNo, hasPhoto: !!d.chipPhotoBase64 });
        Toast.show({ type: 'success', text1: 'NFC okundu', text2: `${d.ad || ''} ${d.soyad || ''}`.trim() || 'Kimlik bilgisi alındı.' });
        // Tam sonuç ekranına geç: foto + bilgiler + Oda Seç / Bildir / Kaydet
        logger.info('[NFC] NfcResult ekranına yönlendiriliyor');
        navigation.replace('NfcResult', {
          data: {
            ad: d.ad || '',
            soyad: d.soyad || '',
            kimlikNo: d.kimlikNo || null,
            pasaportNo: d.pasaportNo || null,
            belgeNo: (d.kimlikNo || d.pasaportNo || '').trim() || null,
            dogumTarihi: d.dogumTarihi || null,
            uyruk: d.uyruk || 'TÜRK',
            chipPhotoBase64: d.chipPhotoBase64 || null,
            chipSignatureBase64: d.chipSignatureBase64 || null,
            ikametAdresi: d.ikametAdresi || null,
            dogumYeri: d.dogumYeri || null,
            type: d.type || 'id_card',
          },
        });
      } else {
        logger.warn('[NFC] Okuma başarısız', { error: result?.error, fallback: result?.fallback });
        Toast.show({ type: 'info', text1: 'NFC okunamadı', text2: result?.error || 'Kartı yaklaştırıp tekrar deneyin.' });
      }
    } catch (e) {
      logger.error('[NFC] Okuma hatası (exception)', e?.message || e);
      Toast.show({ type: 'error', text1: 'Hata', text2: 'NFC okunamadı. Tekrar deneyin.' });
    }
  }, [isSupported, readNfcDirect, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={[styles.backBtn, styles.backBtnLeft]} hitSlop={12} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>NFC ile Oku</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="hardware-chip-outline" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          Kimlik veya pasaport kartını telefonun arkasına yaklaştırın, sabit tutun ve butona basın. NFC açık olmalı. Çip için önce MRZ sekmesinden belgeyi okutup sonra NFC ile okuyabilirsiniz.
        </Text>
        {progress ? (
          <View style={styles.progressWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>{progress}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={handleRead}
          disabled={isReading}
          activeOpacity={0.8}
        >
          {isReading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="hardware-chip-outline" size={22} color="#fff" />
              <Text style={styles.primaryBtnText}>NFC ile oku</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={goToMrz} activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={20} color={colors.primary} />
          <Text style={[styles.secondaryBtnText, { color: colors.text }]}>MRZ / kamera ile oku</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnLeft: { marginLeft: -44 },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  instruction: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 200,
    marginBottom: 16,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
