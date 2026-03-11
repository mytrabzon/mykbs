/**
 * Hızlı NFC toplu okuma — tıklandığı anda hazır, okutulanlar listesi, saniyeler içinde onlarca kimlik.
 * Ayarlardan NFC açıkken ana ekranda (FAB ile tab arası) NFC butonu ile açılır.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NfcManager, { NfcEvents } from 'react-native-nfc-manager';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getLastMrzForBac } from '../utils/lastMrzForBac';
import { useIndependentNfcReader } from '../features/nfc/IndependentNfcReader';
import { logger } from '../utils/logger';

let NfcPassportReader = null;
try {
  NfcPassportReader = require('react-native-nfc-passport-reader').default;
} catch (_) {}

function mapNfcResultToItem(r) {
  const birth = (r.birthDate || '').trim();
  const dogumTarihi = birth.includes('-') ? birth.split('-').reverse().join('.') : birth;
  const docNo = (r.identityNo || r.documentNo || '').trim();
  const isTc = /^\d{11}$/.test(docNo);
  return {
    ad: (r.firstName || '').trim(),
    soyad: (r.lastName || '').trim(),
    kimlikNo: isTc ? docNo : '',
    pasaportNo: !isTc ? docNo : '',
    dogumTarihi,
    uyruk: (r.nationality || 'TÜRK').trim(),
  };
}

export default function QuickNfcScanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [okutulanlar, setOkutulanlar] = useState([]);
  const isIos = Platform.OS === 'ios';
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const { readNfcDirect } = useIndependentNfcReader();

  const readOne = useCallback(async () => {
    if (processingRef.current || !mountedRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      const bacKey = await getLastMrzForBac();
      if (NfcPassportReader && bacKey?.documentNo && bacKey?.birthDate && bacKey?.expiryDate) {
        try {
          const nfcResult = await NfcPassportReader.startReading({
            bacKey: {
              documentNo: bacKey.documentNo,
              birthDate: bacKey.birthDate,
              expiryDate: bacKey.expiryDate,
            },
          });
          if (nfcResult && (nfcResult.firstName || nfcResult.lastName || nfcResult.documentNo)) {
            const item = mapNfcResultToItem(nfcResult);
            const entry = { id: Date.now().toString(), ...item, scannedAt: new Date().toISOString() };
            setOkutulanlar((prev) => [entry, ...prev]);
            try { Vibration.vibrate(80); } catch (_) {}
            Toast.show({ type: 'success', text1: 'Okundu', text2: `${item.ad} ${item.soyad}`.trim() || 'Kimlik eklendi.' });
            return;
          }
        } catch (bacErr) {
          if ((bacErr?.message || '').includes('cancel')) return;
        }
      }
      const result = await readNfcDirect();
      if (!mountedRef.current) return;
      if (result?.success && result?.data) {
        const d = result.data;
        const entry = {
          id: Date.now().toString(),
          ad: d.ad || '',
          soyad: d.soyad || '',
          kimlikNo: (d.kimlikNo || d.pasaportNo || '').trim() || '',
          pasaportNo: (d.pasaportNo || '').trim() || '',
          dogumTarihi: d.dogumTarihi || '',
          uyruk: d.uyruk || 'TÜRK',
          scannedAt: new Date().toISOString(),
        };
        setOkutulanlar((prev) => [entry, ...prev]);
        try { Vibration.vibrate(80); } catch (_) {}
        Toast.show({ type: 'success', text1: 'Okundu', text2: `${entry.ad} ${entry.soyad}`.trim() || 'Kimlik eklendi.' });
      } else {
        Toast.show({ type: 'info', text1: 'Okunamadı', text2: result?.error || 'MRZ okutup tekrar deneyin.' });
      }
    } catch (e) {
      if (mountedRef.current) {
        Toast.show({ type: 'error', text1: 'Hata', text2: e?.message?.includes('cancel') ? 'İptal' : (e?.message || 'Okunamadı') });
      }
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, [readNfcDirect]);

  const readOneRef = useRef(readOne);
  readOneRef.current = readOne;

  const handleTagDiscovered = useCallback(() => {
    if (processingRef.current || !mountedRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    NfcManager.unregisterTagEvent().catch(() => {});
    // Kısa gecikme: unregister sonrası cihazın tag'i tekrar sunması için (bazı cihazlarda gerekli)
    const reRegister = () => {
      if (!mountedRef.current) return;
      NfcManager.registerTagEvent({
        invalidateAfterFirstRead: false,
        alertMessage: 'Bir sonraki kartı yaklaştırın',
      }).then(() => {}).catch(() => setListening(false));
    };
    setTimeout(() => {
      const fn = readOneRef.current;
      if (fn) {
        fn().finally(() => {
          processingRef.current = false;
          if (mountedRef.current) setProcessing(false);
          reRegister();
        });
      } else {
        processingRef.current = false;
        if (mountedRef.current) setProcessing(false);
        reRegister();
      }
    }, 150);
  }, []);

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      let cancelled = false;
      if (isIos) {
        setListening(false);
        return () => { mountedRef.current = false; };
      }
      (async () => {
        try {
          const supported = await NfcManager.isSupported();
          if (!supported) {
            Toast.show({ type: 'info', text1: 'NFC yok', text2: 'Bu cihazda NFC desteklenmiyor.' });
            return;
          }
          await NfcManager.start();
          const enabled = await NfcManager.isEnabled().catch(() => false);
          if (!enabled) {
            Toast.show({ type: 'info', text1: 'NFC kapalı', text2: 'Ayarlardan NFC\'yi açın.' });
            return;
          }
          if (cancelled || !mountedRef.current) return;
          setListening(true);
          NfcManager.setEventListener(NfcEvents.DiscoverTag, handleTagDiscovered);
          await NfcManager.registerTagEvent({
            invalidateAfterFirstRead: false,
            alertMessage: 'Kimlik/pasaport kartını telefonun arkasına yaklaştırın',
          });
        } catch (e) {
          if (mountedRef.current) Toast.show({ type: 'error', text1: 'NFC', text2: e?.message || 'Başlatılamadı' });
          setListening(false);
        }
      })();
      return () => {
        cancelled = true;
        mountedRef.current = false;
        setListening(false);
        NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
        NfcManager.unregisterTagEvent().catch(() => {});
      };
    }, [isIos])
  );

  const clearList = useCallback(() => {
    setOkutulanlar([]);
    Toast.show({ type: 'info', text1: 'Liste temizlendi' });
  }, []);

  const renderItem = useCallback(({ item }) => {
    const docNo = item.kimlikNo || item.pasaportNo || '—';
    const time = item.scannedAt
      ? new Date(item.scannedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '';
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.rowIcon, { backgroundColor: colors.primary + '22' }]}>
          <Ionicons name="person" size={20} color={colors.primary} />
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
            {[item.ad, item.soyad].filter(Boolean).join(' ') || '—'}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
            {docNo} · {item.uyruk || '—'} {time ? ` · ${time}` : ''}
          </Text>
        </View>
      </View>
    );
  }, [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Hızlı NFC Okuma</Text>
        <TouchableOpacity onPress={clearList} style={styles.clearBtn} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.instruction, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}>
        <Ionicons name="hardware-chip-outline" size={24} color={colors.primary} />
        <Text style={[styles.instructionText, { color: colors.textPrimary }]}>
          Kimlik veya pasaport: İsterseniz önce MRZ sekmesinden belgeyi okutun (kimlik 3 satır, pasaport 2 satır). Sonra burada kartı telefonun arkasına tam yaslayıp "Manuel oku"ya basın. Kartı sabit tutun.
        </Text>
      </View>

      {listening && (
        <View style={[styles.statusBar, { backgroundColor: colors.primary + '15' }]}>
          {processing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
          )}
          <Text style={[styles.statusText, { color: colors.textPrimary }]}>
            {processing ? 'Okunuyor…' : 'Dinleniyor — kartı yaklaştırın'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.manualBtn, { backgroundColor: colors.primary }]}
        onPress={() => {
          if (processing) return;
          NfcManager.unregisterTagEvent().catch(() => {});
          readOne().finally(() => {
            if (mountedRef.current && listening) {
              NfcManager.registerTagEvent({
                invalidateAfterFirstRead: false,
                alertMessage: 'Kimlik veya pasaport kartını yaklaştırın',
              }).then(() => {}).catch(() => setListening(false));
            }
          });
        }}
        disabled={processing}
      >
        <Ionicons name="hardware-chip" size={22} color="#fff" />
        <Text style={styles.manualBtnText}>Kartı yaklaştırıp "Manuel oku"ya bas</Text>
      </TouchableOpacity>

      <Text style={[styles.listTitle, { color: colors.textSecondary }]}>
        Okutulanlar ({okutulanlar.length})
      </Text>
      <FlatList
        data={okutulanlar}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, okutulanlar.length === 0 && styles.listEmpty]}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Henüz okuma yok. Kimlik/pasaport kartını telefonun arkasına yaklaştırın.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  clearBtn: { padding: 8 },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  instructionText: { flex: 1, fontSize: 14, lineHeight: 20 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '500' },
  manualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  manualBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  listTitle: { fontSize: 14, fontWeight: '600', marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  listContent: { paddingBottom: 24 },
  listEmpty: { flexGrow: 1 },
  emptyText: { textAlign: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
});
