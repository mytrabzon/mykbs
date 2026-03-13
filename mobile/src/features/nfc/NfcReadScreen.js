/**
 * Ayrı NFC okuma ekranı — MRZ kameradan bağımsız.
 * Çip okumak için BAC anahtarı gerekir: önce MRZ okuyabilir veya belge no / doğum / son kullanma girebilir.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { useIndependentNfcReader } from './IndependentNfcReader';
import { setLastMrzForBac, getLastMrzForBac } from '../../utils/lastMrzForBac';
import { logger } from '../../utils/logger';

function toYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim().replace(/\s/g, '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{8}$/.test(s)) return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  return '';
}

export default function NfcReadScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    readNfcDirect,
    isReading,
    progress,
    isSupported,
  } = useIndependentNfcReader();

  const [manualDocNo, setManualDocNo] = useState('');
  const [manualBirth, setManualBirth] = useState('');
  const [manualExpiry, setManualExpiry] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    getLastMrzForBac().then((k) => setHasStoredKey(!!(k?.documentNo && k?.birthDate && k?.expiryDate)));
  }, []);

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
    let extraKeys = [];
    const docNo = (manualDocNo || '').trim().replace(/\s/g, '');
    const birth = toYYYYMMDD(manualBirth);
    const expiry = toYYYYMMDD(manualExpiry);
    if (docNo && birth && expiry) {
      const key = { documentNo: docNo, birthDate: birth, expiryDate: expiry };
      extraKeys = [key];
      try {
        await setLastMrzForBac({ passportNumber: docNo, documentNumber: docNo, birthDate: birth, expiryDate: expiry });
        setHasStoredKey(true);
      } catch (_) {}
    } else if (!hasStoredKey && !docNo && !manualBirth && !manualExpiry) {
      Toast.show({
        type: 'info',
        text1: 'Çip için belge bilgisi gerekli',
        text2: 'Önce MRZ okuyun veya aşağıya kimlik no, doğum ve son kullanma girin.',
      });
      return;
    }

    logger.info('[NFC] Okuma başlatıldı', { extraKeysCount: extraKeys.length });
    try {
      const result = await readNfcDirect(extraKeys.length > 0 ? { extraKeys } : {});
      logger.info('[NFC] readNfcDirect sonucu', { success: result?.success, hasData: !!result?.data, error: result?.error });
      if (result?.success && result?.data) {
        const d = result.data;
        logger.info('[NFC] Okuma başarılı', { ad: d.ad, soyad: d.soyad, kimlikNo: d.kimlikNo, pasaportNo: d.pasaportNo, hasPhoto: !!d.chipPhotoBase64 });
        Toast.show({ type: 'success', text1: 'NFC okundu', text2: `${d.ad || ''} ${d.soyad || ''}`.trim() || 'Kimlik bilgisi alındı.' });
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
  }, [isSupported, readNfcDirect, navigation, manualDocNo, manualBirth, manualExpiry, hasStoredKey]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={goBack} style={[styles.backBtn, styles.backBtnLeft]} hitSlop={12} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>NFC ile Oku</Text>
        <View style={styles.backBtn} />
      </View>

      {progress ? (
        <View style={[styles.progressWrapTop, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.progressText, { color: colors.text }]} numberOfLines={1}>{progress}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
          <Ionicons name="hardware-chip-outline" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.instruction, { color: colors.textSecondary }]}>
          Kimlik/pasaport çipini okumak için önce MRZ okuyun veya aşağıya belge bilgilerini girin. Sonra kartı telefonun arkasına yaslayıp «NFC ile oku»ya basın.
        </Text>

        <View style={[styles.formBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.textPrimary }]}>Belge bilgisi (çip erişimi)</Text>
          <Text style={[styles.formHint, { color: colors.textSecondary }]}>Kimlik no (11 hane) veya pasaport no</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Belge no"
            placeholderTextColor={colors.textSecondary}
            value={manualDocNo}
            onChangeText={setManualDocNo}
            keyboardType="number-pad"
            maxLength={20}
            editable={!isReading}
          />
          <Text style={[styles.formHint, { color: colors.textSecondary }]}>Doğum tarihi (GG.AA.YYYY veya YYYY-MM-DD)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Örn. 15.05.1990"
            placeholderTextColor={colors.textSecondary}
            value={manualBirth}
            onChangeText={setManualBirth}
            keyboardType="numbers-and-punctuation"
            editable={!isReading}
          />
          <Text style={[styles.formHint, { color: colors.textSecondary }]}>Son kullanma tarihi</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
            placeholder="Örn. 01.01.2030"
            placeholderTextColor={colors.textSecondary}
            value={manualExpiry}
            onChangeText={setManualExpiry}
            keyboardType="numbers-and-punctuation"
            editable={!isReading}
          />
        </View>

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
      </ScrollView>
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
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  formBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  formTitle: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  formHint: { fontSize: 12, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
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
  progressWrapTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    flex: 1,
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
