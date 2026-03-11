/**
 * Hızlı NFC toplu okuma — okutulanlar backend'de kalıcı, liste tıklanabilir, foto + Oda Seç / Bildir.
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
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NfcManager, { NfcEvents } from 'react-native-nfc-manager';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getLastMrzForBac } from '../utils/lastMrzForBac';
import { useIndependentNfcReader } from '../features/nfc/IndependentNfcReader';
import { getApiBaseUrl } from '../config/api';
import { api } from '../services/api';
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
    chipPhotoBase64: r.originalFacePhoto || null,
  };
}

export default function QuickNfcScanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [okutulanlar, setOkutulanlar] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [bildirItem, setBildirItem] = useState(null);
  const [odalar, setOdalar] = useState([]);
  const [odalarLoading, setOdalarLoading] = useState(false);
  const [selectedOda, setSelectedOda] = useState(null);
  const [misafirTipi, setMisafirTipi] = useState('tc_vatandasi');
  const [bildirLoading, setBildirLoading] = useState(false);
  const isIos = Platform.OS === 'ios';
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const { readNfcDirect } = useIndependentNfcReader();

  const loadOkutulanlar = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await api.get('/okutulan-belgeler?limit=100');
      if (mountedRef.current) setOkutulanlar(res.data?.items ?? []);
    } catch (_) {
      if (mountedRef.current) setOkutulanlar([]);
    } finally {
      if (mountedRef.current) setListLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOkutulanlar();
    }, [loadOkutulanlar])
  );

  const saveToBackend = useCallback(async (d) => {
    const docNo = (d.kimlikNo || d.pasaportNo || '').trim();
    const isTc = /^\d{11}$/.test(docNo);
    const body = {
      belgeTuru: (d.type === 'id_card' || isTc) ? 'kimlik' : 'pasaport',
      ad: (d.ad || '').trim() || '—',
      soyad: (d.soyad || '').trim() || '—',
      kimlikNo: isTc ? docNo : null,
      pasaportNo: !isTc ? docNo : null,
      belgeNo: docNo || null,
      dogumTarihi: d.dogumTarihi || null,
      uyruk: (d.uyruk || 'TÜRK').trim(),
    };
    if (d.chipPhotoBase64) body.portraitPhotoBase64 = d.chipPhotoBase64;
    await api.post('/okutulan-belgeler', body);
  }, []);

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
            await saveToBackend({ ...item, type: 'id_card' });
            if (mountedRef.current) await loadOkutulanlar();
            try { Vibration.vibrate(80); } catch (_) {}
            Toast.show({ type: 'success', text1: 'Okundu & kaydedildi', text2: `${item.ad} ${item.soyad}`.trim() || 'Kimlik eklendi.' });
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
        await saveToBackend(d);
        if (mountedRef.current) await loadOkutulanlar();
        try { Vibration.vibrate(80); } catch (_) {}
        Toast.show({ type: 'success', text1: 'Okundu & kaydedildi', text2: `${d.ad || ''} ${d.soyad || ''}`.trim() || 'Kimlik eklendi.' });
      } else {
        Toast.show({ type: 'info', text1: 'Okunamadı', text2: result?.error || 'MRZ okutup tekrar deneyin.' });
      }
    } catch (e) {
      if (mountedRef.current) {
        Toast.show({ type: 'error', text1: 'Hata', text2: e?.message?.includes('cancel') ? 'İptal' : (e?.response?.data?.message || e?.message || 'Okunamadı') });
      }
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, [readNfcDirect, saveToBackend, loadOkutulanlar]);

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

  React.useEffect(() => {
    if (!bildirItem) return;
    setOdalarLoading(true);
    setSelectedOda(null);
    api.get('/oda?filtre=tumu')
      .then((res) => setOdalar(res.data?.odalar ?? []))
      .catch(() => setOdalar([]))
      .finally(() => setOdalarLoading(false));
  }, [bildirItem]);

  const handleBildir = useCallback(async () => {
    if (!bildirItem || !selectedOda) {
      Toast.show({ type: 'info', text1: 'Oda seçin', text2: 'KBS\'ye göndermek için oda seçin.' });
      return;
    }
    setBildirLoading(true);
    try {
      await api.post(`/okutulan-belgeler/${bildirItem.id}/bildir`, { odaId: selectedOda.id, misafirTipi });
      Toast.show({ type: 'success', text1: 'KBS\'ye gönderildi', text2: `Oda ${selectedOda.odaNumarasi}` });
      setBildirItem(null);
      loadOkutulanlar();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: err?.response?.data?.message || err?.message || 'Bildirim gönderilemedi' });
    } finally {
      setBildirLoading(false);
    }
  }, [bildirItem, selectedOda, misafirTipi, loadOkutulanlar]);

  const photoUri = useCallback((item) => {
    const url = item?.portraitPhotoUrl || item?.photoUrl;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const base = getApiBaseUrl();
    return base ? `${base.replace(/\/$/, '')}${url}` : url;
  }, []);

  const refreshList = useCallback(() => {
    loadOkutulanlar();
    Toast.show({ type: 'info', text1: 'Liste yenilendi' });
  }, [loadOkutulanlar]);

  const renderItem = useCallback(({ item }) => {
    const docNo = item.kimlikNo || item.pasaportNo || item.belgeNo || '—';
    const thumb = photoUri(item);
    const time = item.createdAt ? new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        onPress={() => setDetail(item)}
        activeOpacity={0.7}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.rowThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.rowThumb, styles.rowThumbPlaceholder, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
        )}
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
            👤 {[item.ad, item.soyad].filter(Boolean).join(' ') || '—'}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
            🆔 {docNo}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
            📍 {item.odaNo ? `Oda ${item.odaNo}` : 'Oda seçilmedi'} {time ? ` · ${time}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={[styles.rowActionBtn, { backgroundColor: colors.primary + '18' }]} onPress={(e) => { e.stopPropagation(); setBildirItem(item); }}>
          <Ionicons name="send" size={18} color={colors.primary} />
          <Text style={[styles.rowActionText, { color: colors.primary }]}>Bildir</Text>
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  }, [colors, photoUri]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Hızlı NFC Okuma</Text>
        <TouchableOpacity onPress={refreshList} style={styles.clearBtn} hitSlop={12}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
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
      {listLoading ? (
        <View style={styles.listLoadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Yükleniyor…</Text>
        </View>
      ) : (
        <FlatList
          data={okutulanlar}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, okutulanlar.length === 0 && styles.listEmpty]}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Henüz okuma yok. Kimlik/pasaport kartını telefonun arkasına yaklaştırın; okunanlar otomatik kaydedilir.
            </Text>
          }
        />
      )}

      {/* Detay modal */}
      <Modal visible={!!detail} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetail(null)}>
          <TouchableOpacity style={[styles.detailModal, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.detailHeader}>
              <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>Belge detayı</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={16}>
                <Ionicons name="close" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {detail && (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                {(photoUri(detail)) ? (
                  <Image source={{ uri: photoUri(detail) }} style={styles.detailPhoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.detailPhotoPlaceholder, { backgroundColor: colors.border + '40' }]}>
                    <Ionicons name="person" size={48} color={colors.textSecondary} />
                  </View>
                )}
                <Text style={[styles.detailName, { color: colors.textPrimary }]}>{detail.ad} {detail.soyad}</Text>
                <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>Belge no: {detail.kimlikNo || detail.pasaportNo || detail.belgeNo || '—'}</Text>
                <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>Doğum: {detail.dogumTarihi || '—'}</Text>
                <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>Uyruk: {detail.uyruk || '—'}</Text>
                <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>Oda: {detail.odaNo ? detail.odaNo : 'Seçilmedi'}</Text>
                <TouchableOpacity style={[styles.bildirBtnDetail, { borderColor: colors.primary }]} onPress={() => { setDetail(null); setBildirItem(detail); }}>
                  <Ionicons name="send" size={20} color={colors.primary} />
                  <Text style={[styles.bildirBtnDetailText, { color: colors.primary }]}>KBS'ye bildir</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Bildir modal */}
      <Modal visible={!!bildirItem} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setBildirItem(null)}>
          <TouchableOpacity style={[styles.bildirSheet, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.bildirHeader}>
              <Text style={[styles.bildirTitle, { color: colors.textPrimary }]}>KBS'ye bildir</Text>
              <TouchableOpacity onPress={() => setBildirItem(null)} hitSlop={16}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {bildirItem && (
              <>
                <Text style={[styles.bildirSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {bildirItem.ad} {bildirItem.soyad} · Oda seçin
                </Text>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Misafir tipi</Text>
                <View style={styles.misafirTipiRow}>
                  {[
                    { value: 'tc_vatandasi', label: 'T.C.' },
                    { value: 'ykn', label: 'YKN' },
                    { value: 'yabanci', label: 'Yabancı' },
                  ].map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.misafirTipiBtn, { borderColor: colors.border }, misafirTipi === value && { borderColor: colors.primary, backgroundColor: colors.primary + '18' }]}
                      onPress={() => setMisafirTipi(value)}
                    >
                      <Text style={[styles.misafirTipiBtnText, { color: colors.textSecondary }, misafirTipi === value && { color: colors.primary, fontWeight: '600' }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Oda seçin (boş odalar)</Text>
                {odalarLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
                ) : (
                  <ScrollView style={styles.odaList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {odalar.filter((o) => o.durum === 'bos').map((oda) => (
                      <TouchableOpacity
                        key={oda.id}
                        style={[styles.odaItem, { borderColor: colors.border }, selectedOda?.id === oda.id && { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
                        onPress={() => setSelectedOda(oda)}
                      >
                        <Text style={[styles.odaItemText, { color: colors.textPrimary }]}>Oda {oda.odaNumarasi}</Text>
                        {selectedOda?.id === oda.id ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.bildirActions}>
                  <TouchableOpacity
                    style={[styles.bildirSubmitBtn, { backgroundColor: colors.primary }]}
                    onPress={handleBildir}
                    disabled={bildirLoading || !selectedOda}
                  >
                    {bildirLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.bildirSubmitText}>Gönder</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bildirCancelBtn, { borderColor: colors.border }]} onPress={() => setBildirItem(null)}>
                    <Text style={[styles.bildirCancelText, { color: colors.textSecondary }]}>İptal</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  listLoadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyText: { textAlign: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  rowThumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  rowActionText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  detailModal: { borderRadius: 16, maxHeight: '85%' },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  detailTitle: { fontSize: 18, fontWeight: '700' },
  detailScroll: { maxHeight: 400, padding: 16 },
  detailPhoto: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12, backgroundColor: '#f0f0f0' },
  detailPhotoPlaceholder: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12, justifyContent: 'center', alignItems: 'center' },
  detailName: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  detailMeta: { fontSize: 14, marginBottom: 4 },
  bildirBtnDetail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderWidth: 1, borderRadius: 12 },
  bildirBtnDetailText: { fontSize: 15, fontWeight: '600' },
  bildirSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 24, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  bildirHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bildirTitle: { fontSize: 18, fontWeight: '700' },
  bildirSubtitle: { fontSize: 14, marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  misafirTipiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  misafirTipiBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  misafirTipiBtnText: { fontSize: 14 },
  odaList: { maxHeight: 200, marginBottom: 16 },
  odaItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 12, borderWidth: 1 },
  odaItemText: { fontSize: 16, fontWeight: '600' },
  bildirActions: { gap: 10 },
  bildirSubmitBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  bildirSubmitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  bildirCancelBtn: { paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  bildirCancelText: { fontSize: 15, fontWeight: '600' },
});
