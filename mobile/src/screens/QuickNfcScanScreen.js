/**
 * Hızlı NFC toplu okuma — okutulanlar backend'de kalıcı, liste tıklanabilir, foto + Oda Seç / Bildir.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
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
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
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
import NfcRoundAnimatedButton from '../components/nfc/NfcRoundAnimatedButton';
import OdaAtamaSheet from '../components/OdaAtamaSheet';

let NfcPassportReader = null;
try {
  NfcPassportReader = require('react-native-nfc-passport-reader').default;
} catch (_) {}

function mapNfcResultToItem(r) {
  const birth = (r.birthDate || '').trim();
  const dogumTarihi = birth.includes('-') ? birth.split('-').reverse().join('.') : birth;
  const docNo = (r.personalNumber || r.identityNo || r.documentNo || '').trim();
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
  const [listLoading, setListLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [bildirItem, setBildirItem] = useState(null);
  const [odalar, setOdalar] = useState([]);
  const [odalarLoading, setOdalarLoading] = useState(false);
  const [selectedOda, setSelectedOda] = useState(null);
  const [misafirTipi, setMisafirTipi] = useState('tc_vatandasi');
  const [bildirLoading, setBildirLoading] = useState(false);
  const [odalarError, setOdalarError] = useState(null);
  const [showOdaAtamaSheet, setShowOdaAtamaSheet] = useState(false);
  const [odaAtamaItem, setOdaAtamaItem] = useState(null);
  const [odaAtamaLoading, setOdaAtamaLoading] = useState(false);
  const isIos = Platform.OS === 'ios';
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [nfcDebugLines, setNfcDebugLines] = useState([]);
  const [hasStoredMrz, setHasStoredMrz] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const { readNfcDirect } = useIndependentNfcReader();

  const addNfcDebug = useCallback((msg) => {
    const line = `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`;
    if (!mountedRef.current) return;
    setNfcDebugLines((prev) => [...prev.slice(-24), line]);
  }, []);

  const loadOkutulanlar = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setListLoading(true);
    try {
      const res = await api.get('/okutulan-belgeler?limit=100');
      if (mountedRef.current) setOkutulanlar(res.data?.items ?? []);
    } catch (_) {
      if (mountedRef.current) setOkutulanlar([]);
    } finally {
      if (mountedRef.current && !silent) setListLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOkutulanlar({ silent: true });
      getLastMrzForBac().then((bac) => {
        if (mountedRef.current) setHasStoredMrz(!!(bac?.documentNo && bac?.birthDate && bac?.expiryDate));
      });
      return () => {
        setOkutulanlar([]);
        setDetail(null);
      };
    }, [loadOkutulanlar])
  );

  /** Yeni okutulanı hemen listeye ekler (animasyonla), ardından arka planda listeyi sessizce günceller (foto URL vb.). */
  const prependNewItemAndRefresh = useCallback((resData, d) => {
    if (!d || typeof d !== 'object') return;
    const docNo = (d.kimlikNo || d.pasaportNo || '').trim();
    const isTc = /^\d{11}$/.test(docNo);
    const stub = {
      id: resData?.id ?? `temp-${Date.now()}`,
      ad: (d.ad || '').trim() || '—',
      soyad: (d.soyad || '').trim() || '—',
      kimlikNo: isTc ? docNo : null,
      pasaportNo: !isTc ? docNo : null,
      belgeNo: docNo || null,
      dogumTarihi: d.dogumTarihi || null,
      uyruk: (d.uyruk || 'TÜRK').trim(),
      ikametAdresi: d.ikametAdresi || null,
      odaNo: null,
      createdAt: resData?.createdAt || new Date().toISOString(),
      portraitPhotoUrl: d.chipPhotoBase64 ? `data:image/jpeg;base64,${d.chipPhotoBase64}` : null,
      photoUrl: null,
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOkutulanlar((prev) => [stub, ...prev]);
    loadOkutulanlar({ silent: true });
  }, [loadOkutulanlar]);

  const saveToBackend = useCallback(async (d) => {
    const docNo = (d.kimlikNo || d.pasaportNo || '').trim();
    const isTc = /^\d{11}$/.test(docNo);
    const isTurkish = String(d.uyruk || '').toUpperCase().includes('TÜRK');
    const isKimlik = d.type === 'id_card' || isTc || (isTurkish && d.type !== 'passport');
    const body = {
      belgeTuru: isKimlik ? 'kimlik' : 'pasaport',
      ad: (d.ad || '').trim() || '—',
      soyad: (d.soyad || '').trim() || '—',
      kimlikNo: isTc ? docNo : null,
      pasaportNo: !isTc ? docNo : null,
      belgeNo: docNo || null,
      dogumTarihi: d.dogumTarihi || null,
      uyruk: (d.uyruk || 'TÜRK').trim(),
    };
    if (d.chipPhotoBase64) body.portraitPhotoBase64 = d.chipPhotoBase64;
    const res = await api.post('/okutulan-belgeler', body);
    return res;
  }, []);

  const readOne = useCallback(async () => {
    if (processingRef.current || !mountedRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    addNfcDebug('NFC okuma başladı');
    try {
      const bacKey = await getLastMrzForBac();
      if (NfcPassportReader && bacKey?.documentNo && bacKey?.birthDate && bacKey?.expiryDate) {
        addNfcDebug(`BAC denenecek (MRZ): docNo=${bacKey.documentNo?.slice(0, 6)}...`);
        try {
          const nfcResult = await NfcPassportReader.startReading({
            bacKey: {
              documentNo: bacKey.documentNo,
              birthDate: bacKey.birthDate,
              expiryDate: bacKey.expiryDate,
            },
            includeImages: true,
          });
          const hasName = nfcResult && (nfcResult.firstName || nfcResult.lastName);
          const hasDoc = nfcResult && (nfcResult.documentNo || nfcResult.personalNumber || nfcResult.identityNo);
          if (nfcResult && (hasName || hasDoc)) {
            addNfcDebug(`Native OK: ad=${nfcResult.firstName || '-'} soyad=${nfcResult.lastName || '-'} docNo=${nfcResult.documentNo || nfcResult.personalNumber || '-'}`);
            const item = mapNfcResultToItem(nfcResult);
            let res;
            try {
              res = await saveToBackend({ ...item, type: 'id_card' });
            } catch (saveErr) {
              addNfcDebug('Kayıt hatası: ' + (saveErr?.response?.data?.message || saveErr?.message));
              Toast.show({ type: 'error', text1: 'Kayıt hatası', text2: saveErr?.response?.data?.message || saveErr?.message || 'Sunucuya kaydedilemedi.' });
              return;
            }
            if (mountedRef.current) {
              const resData = res?.data;
              if (resData && (resData.id != null || resData.createdAt != null)) {
                try {
                  prependNewItemAndRefresh(resData, item);
                } catch (_) {
                  loadOkutulanlar({ silent: true });
                }
              } else {
                loadOkutulanlar({ silent: true });
              }
            }
            try { Vibration.vibrate(80); } catch (_) {}
            Toast.show({ type: 'success', text1: 'Okundu & kaydedildi', text2: `${item.ad} ${item.soyad}`.trim() || 'Kimlik eklendi.' });
            return;
          }
          addNfcDebug('Native döndü ama ad/soyad/belge no yok. firstName=' + (nfcResult?.firstName || '') + ' lastName=' + (nfcResult?.lastName || '') + ' documentNo=' + (nfcResult?.documentNo || '') + ' personalNumber=' + (nfcResult?.personalNumber || ''));
        } catch (bacErr) {
          if ((bacErr?.message || '').includes('cancel')) return;
          addNfcDebug('BAC (MRZ) hata: ' + (bacErr?.message || 'bilinmiyor'));
        }
      } else {
        addNfcDebug('Kayıtlı MRZ yok, readNfcDirect (default key\'ler) deneniyor');
      }
      const result = await readNfcDirect();
      if (!mountedRef.current) return;
      if (result?.success && result?.data) {
        const d = result.data;
        const hasUseful = (d.ad || d.soyad || d.kimlikNo || d.pasaportNo);
        if (!hasUseful) {
          addNfcDebug('HATA: Veri geldi ama ad/soyad/kimlikNo/pasaportNo boş. Gelen alanlar: ' + JSON.stringify(Object.keys(d)) + ' | ad=' + (d.ad || '') + ' soyad=' + (d.soyad || '') + ' kimlikNo=' + (d.kimlikNo || '') + ' pasaportNo=' + (d.pasaportNo || ''));
        } else {
          addNfcDebug('readNfcDirect OK: ad=' + (d.ad || '-') + ' soyad=' + (d.soyad || '-') + ' kimlikNo=' + (d.kimlikNo || '-') + ' pasaportNo=' + (d.pasaportNo || '-'));
        }
        let res;
        try {
          res = await saveToBackend(d);
        } catch (saveErr) {
          addNfcDebug('Kayıt hatası: ' + (saveErr?.response?.data?.message || saveErr?.message));
          Toast.show({ type: 'error', text1: 'Kayıt hatası', text2: saveErr?.response?.data?.message || saveErr?.message || 'Sunucuya kaydedilemedi.' });
          return;
        }
        if (mountedRef.current) {
          const resData = res?.data;
          if (resData && (resData.id != null || resData.createdAt != null)) {
            try {
              prependNewItemAndRefresh(resData, d);
            } catch (_) {
              loadOkutulanlar({ silent: true });
            }
          } else {
            loadOkutulanlar({ silent: true });
          }
        }
        try { Vibration.vibrate(80); } catch (_) {}
        Toast.show({ type: 'success', text1: 'Okundu & kaydedildi', text2: `${d.ad || ''} ${d.soyad || ''}`.trim() || 'Kimlik eklendi.' });
      } else {
        addNfcDebug('readNfcDirect BAŞARISIZ: ' + (result?.error || 'bilinmiyor') + (result?.fallback ? ' | fallback=' + result.fallback : ''));
        Toast.show({ type: 'info', text1: 'Okunamadı', text2: result?.error || 'MRZ okutup tekrar deneyin.' });
      }
    } catch (e) {
      const msg = e?.message?.includes('cancel') ? 'İptal' : (e?.response?.data?.message || e?.message || 'Okunamadı');
      addNfcDebug('Exception: ' + msg);
      if (mountedRef.current) {
        Toast.show({ type: 'error', text1: 'Hata', text2: msg });
      }
    } finally {
      processingRef.current = false;
      if (mountedRef.current) setProcessing(false);
    }
  }, [readNfcDirect, saveToBackend, loadOkutulanlar, prependNewItemAndRefresh, addNfcDebug]);

  const readOneRef = useRef(readOne);
  readOneRef.current = readOne;

  // Aynı kart yakındayken sürekli tetiklenmesin: okuma bitince bu süre bekleyip sonra tekrar dinlemeye al
  const NFC_RE_REGISTER_DELAY_MS = 2500;

  const handleTagDiscovered = useCallback(() => {
    if (processingRef.current || !mountedRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.unregisterTagEvent().catch(() => {});
    const reRegister = () => {
      if (!mountedRef.current) return;
      NfcManager.setEventListener(NfcEvents.DiscoverTag, handleTagDiscovered);
      NfcManager.registerTagEvent({
        invalidateAfterFirstRead: false,
        alertMessage: 'Bir sonraki kartı yaklaştırın',
      }).then(() => {
        if (mountedRef.current) setListening(true);
      }).catch(() => {
        if (mountedRef.current) setListening(false);
      });
    };
    setTimeout(() => {
      const fn = readOneRef.current;
      if (fn) {
        fn().finally(() => {
          processingRef.current = false;
          if (mountedRef.current) setProcessing(false);
          setTimeout(reRegister, NFC_RE_REGISTER_DELAY_MS);
        });
      } else {
        processingRef.current = false;
        if (mountedRef.current) setProcessing(false);
        setTimeout(reRegister, NFC_RE_REGISTER_DELAY_MS);
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
    if (!bildirItem) {
      setOdalarError(null);
      return;
    }
    setOdalarLoading(true);
    setSelectedOda(null);
    setOdalarError(null);
    const timeoutMs = 12000;
    const timeoutId = setTimeout(() => {
      setOdalarLoading(false);
      setOdalarError('Oda listesi gecikti. Yeniden deneyin.');
    }, timeoutMs);
    api.get('/oda?filtre=tumu')
      .then((res) => {
        const list = res?.data?.odalar ?? [];
        setOdalar(Array.isArray(list) ? list : []);
        setOdalarError(null);
      })
      .catch(() => {
        setOdalar([]);
        setOdalarError('Odalar yüklenemedi. İnternet bağlantısını kontrol edin.');
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setOdalarLoading(false);
      });
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
      loadOkutulanlar({ silent: true });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: err?.response?.data?.message || err?.message || 'Bildirim gönderilemedi' });
    } finally {
      setBildirLoading(false);
    }
  }, [bildirItem, selectedOda, misafirTipi, loadOkutulanlar]);

  const photoUri = useCallback((item) => {
    const url = item?.portraitPhotoUrl || item?.photoUrl;
    if (!url) return null;
    if (url.startsWith('data:')) return url;
    if (url.startsWith('http')) return url;
    const base = getApiBaseUrl();
    return base ? `${base.replace(/\/$/, '')}${url}` : url;
  }, []);

  const refreshList = useCallback(() => {
    loadOkutulanlar();
    Toast.show({ type: 'info', text1: 'Liste yenilendi' });
  }, [loadOkutulanlar]);

  const handleOdaAtamaSelect = useCallback(async (oda) => {
    if (!odaAtamaItem?.id) return;
    setOdaAtamaLoading(true);
    try {
      await api.put(`/okutulan-belgeler/${odaAtamaItem.id}/oda`, { odaId: oda.id });
      Toast.show({ type: 'success', text1: 'Oda atandı', text2: `Oda ${oda.odaNumarasi}` });
      setDetail((prev) => (prev && prev.id === odaAtamaItem.id ? { ...prev, odaNo: oda.odaNumarasi } : prev));
      setOdaAtamaItem(null);
      setShowOdaAtamaSheet(false);
      loadOkutulanlar({ silent: true });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Atanamadı', text2: err?.response?.data?.message || err?.message || 'Oda atanamadı' });
    } finally {
      setOdaAtamaLoading(false);
    }
  }, [odaAtamaItem, loadOkutulanlar]);

  const renderItem = useCallback(({ item }) => {
    const docNo = item.kimlikNo || item.pasaportNo || item.belgeNo || '—';
    const thumb = photoUri(item);
    const time = item.createdAt ? new Date(item.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    const fullName = [item.ad, item.soyad].filter(Boolean).join(' ').trim() || '—';
    const bilgiCiptenGelmedi = fullName === '—';
    const isTc = item.kimlikNo != null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setDetail(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardInner}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.cardPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={2}>
              {fullName}
            </Text>
            {bilgiCiptenGelmedi ? (
              <Text style={[styles.cardChipNote, { color: colors.textSecondary }]}>Ad/soyad çipten okunamadı. Tekrar deneyin.</Text>
            ) : null}
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMetaLabel, { color: colors.textSecondary }]}>Belge</Text>
              <Text style={[styles.cardMetaValue, { color: colors.textPrimary }]}>{isTc ? 'TC' : 'Pasaport'} · {docNo}</Text>
            </View>
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMetaLabel, { color: colors.textSecondary }]}>Doğum</Text>
              <Text style={[styles.cardMetaValue, { color: colors.textPrimary }]}>{item.dogumTarihi || '—'}</Text>
            </View>
            <View style={styles.cardMetaRow}>
              <Text style={[styles.cardMetaLabel, { color: colors.textSecondary }]}>Uyruk</Text>
              <Text style={[styles.cardMetaValue, { color: colors.textPrimary }]}>{item.uyruk || '—'}</Text>
            </View>
            {item.ikametAdresi ? (
              <View style={styles.cardMetaRow}>
                <Text style={[styles.cardMetaLabel, { color: colors.textSecondary }]}>Adres</Text>
                <Text style={[styles.cardMetaValue, { color: colors.textPrimary }]} numberOfLines={2}>{item.ikametAdresi}</Text>
              </View>
            ) : null}
            <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.cardOdaTime, { color: colors.textSecondary }]}>
                {item.odaNo ? `Oda ${item.odaNo}` : 'Oda atanmadı'} {time ? ` · ${time}` : ''}
              </Text>
              <TouchableOpacity style={[styles.cardBildirBtn, { backgroundColor: colors.primary }]} onPress={(e) => { e.stopPropagation(); setBildirItem(item); }}>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.cardBildirText}>Bildir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [colors, photoUri]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Hızlı NFC Okuma</Text>
        <TouchableOpacity onPress={refreshList} style={styles.clearBtn} hitSlop={12}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {nfcDebugLines.length > 0 && (
        <View style={styles.nfcDebugPanel}>
          <View style={styles.nfcDebugHeader}>
            <Text style={styles.nfcDebugTitle}>NFC Debug (hatanın nedeni)</Text>
            <TouchableOpacity onPress={() => setNfcDebugLines([])} hitSlop={8} style={styles.nfcDebugClearBtn}>
              <Ionicons name="close-circle" size={22} color="#c0392b" />
              <Text style={styles.nfcDebugClearText}>Temizle</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.nfcDebugScroll} nestedScrollEnabled showsVerticalScrollIndicator={true}>
            {nfcDebugLines.map((line, idx) => (
              <Text key={idx} style={styles.nfcDebugLine} numberOfLines={3}>{line}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.mainContent}>
        {listening && (
          <View style={[styles.statusPill, { backgroundColor: colors.primary + '18' }]}>
            {processing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            )}
            <Text style={[styles.statusText, { color: colors.textPrimary }]}>
              {processing ? 'Okunuyor…' : 'Hazır'}
            </Text>
          </View>
        )}

        {!hasStoredMrz && (
          <View style={[styles.mrzHintCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
            <Ionicons name="information-circle" size={22} color={colors.primary} />
            <View style={styles.mrzHintTextWrap}>
              <Text style={[styles.mrzHintTitle, { color: colors.textPrimary }]}>ID kartı NFC neden okunmuyor?</Text>
              <Text style={[styles.mrzHintBody, { color: colors.textSecondary }]}>
                Kimlik/pasaport çipi MRZ ile açılır. Önce kartın arkasındaki MRZ alanını okutun, sonra kartı telefona yaklaştırın.
              </Text>
              <TouchableOpacity
                style={[styles.mrzHintBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('MrzScan', { fromCheckIn: true })}
              >
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.mrzHintBtnText}>MRZ oku</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <NfcRoundAnimatedButton
          onPress={() => {
            if (processing) return;
            NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
            NfcManager.unregisterTagEvent().catch(() => {});
            readOne().finally(() => {
              if (!mountedRef.current || !listening || isIos) return;
              setTimeout(() => {
                if (!mountedRef.current) return;
                NfcManager.setEventListener(NfcEvents.DiscoverTag, handleTagDiscovered);
                NfcManager.registerTagEvent({
                  invalidateAfterFirstRead: false,
                  alertMessage: 'Kimlik veya pasaport kartını yaklaştırın',
                }).then(() => { if (mountedRef.current) setListening(true); }).catch(() => setListening(false));
              }, NFC_RE_REGISTER_DELAY_MS);
            });
          }}
          disabled={processing}
        />

        <View style={styles.listHead}>
          <Text style={[styles.listTitle, { color: colors.textPrimary }]}>Okutulan kişiler</Text>
          <Text style={[styles.listCount, { color: colors.textSecondary }]}>{okutulanlar.length} kayıt</Text>
        </View>
        <FlatList
          data={okutulanlar}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.listContent, okutulanlar.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            listLoading ? (
              <View style={styles.listLoadingWrap}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Yükleniyor…</Text>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Henüz okuma yok. NFC ile kartı okutun.
              </Text>
            )
          }
        />
      </View>

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
                <TouchableOpacity
                  style={[styles.bildirBtnDetail, { borderColor: colors.primary }]}
                  onPress={() => { setOdaAtamaItem(detail); setShowOdaAtamaSheet(true); }}
                  disabled={odaAtamaLoading}
                >
                  <Ionicons name="bed-outline" size={20} color={colors.primary} />
                  <Text style={[styles.bildirBtnDetailText, { color: colors.primary }]}>{detail.odaNo ? 'Oda değiştir' : 'Oda ata'}</Text>
                </TouchableOpacity>
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
                  <View style={styles.odaLoadingWrap}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.odaLoadingText, { color: colors.textSecondary }]}>Odalar getiriliyor…</Text>
                  </View>
                ) : odalarError ? (
                  <View style={styles.odaErrorWrap}>
                    <Text style={[styles.odaErrorText, { color: colors.textSecondary }]}>{odalarError}</Text>
                    <TouchableOpacity style={[styles.odaRetryBtn, { borderColor: colors.primary }]} onPress={() => { setOdalarError(null); setOdalarLoading(true); api.get('/oda?filtre=tumu').then((res) => { setOdalar(res?.data?.odalar ?? []); setOdalarError(null); }).catch(() => { setOdalar([]); setOdalarError('Odalar yüklenemedi.'); }).finally(() => setOdalarLoading(false)); }}>
                      <Ionicons name="refresh" size={18} color={colors.primary} />
                      <Text style={[styles.odaRetryText, { color: colors.primary }]}>Tekrar dene</Text>
                    </TouchableOpacity>
                  </View>
                ) : odalar.filter((o) => o.durum === 'bos').length === 0 ? (
                  <Text style={[styles.odaEmptyText, { color: colors.textSecondary }]}>Boş oda yok veya liste alınamadı.</Text>
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

      <OdaAtamaSheet
        visible={showOdaAtamaSheet}
        onClose={() => { setShowOdaAtamaSheet(false); setOdaAtamaItem(null); }}
        onSelect={handleOdaAtamaSelect}
        title={odaAtamaItem?.odaNo ? 'Oda değiştir' : 'Oda ata'}
        currentOdaNo={odaAtamaItem?.odaNo ?? null}
        onlyEmptyForBildir={false}
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  backBtn: { padding: 8, marginLeft: -44 },
  clearBtn: { padding: 8 },
  mainContent: { flex: 1, paddingHorizontal: 16 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  mrzHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  mrzHintTextWrap: { flex: 1, minWidth: 0 },
  mrzHintTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  mrzHintBody: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  mrzHintBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  mrzHintBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  listTitle: { fontSize: 17, fontWeight: '700' },
  listCount: { fontSize: 13, fontWeight: '500' },
  listContent: { paddingBottom: 24, paddingTop: 4 },
  listEmpty: { flexGrow: 1 },
  listLoadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { textAlign: 'center', fontSize: 15, paddingVertical: 32, paddingHorizontal: 24 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardInner: { flexDirection: 'row', padding: 14 },
  cardPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  cardPhotoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  cardBody: { flex: 1, minWidth: 0, marginLeft: 14 },
  cardName: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardChipNote: { fontSize: 11, fontStyle: 'italic', marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardMetaLabel: { fontSize: 12, width: 52 },
  cardMetaValue: { fontSize: 13, fontWeight: '500', flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  cardOdaTime: { fontSize: 12, fontWeight: '500' },
  cardBildirBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  cardBildirText: { fontSize: 13, fontWeight: '700', color: '#fff' },
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
  odaLoadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 20 },
  odaLoadingText: { fontSize: 14 },
  odaErrorWrap: { paddingVertical: 16, paddingHorizontal: 12 },
  odaErrorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  odaRetryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderWidth: 1, borderRadius: 10 },
  odaRetryText: { fontSize: 14, fontWeight: '600' },
  odaEmptyText: { fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  odaList: { maxHeight: 200, marginBottom: 16 },
  odaItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, borderRadius: 12, borderWidth: 1 },
  odaItemText: { fontSize: 16, fontWeight: '600' },
  bildirActions: { gap: 10 },
  bildirSubmitBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  bildirSubmitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  bildirCancelBtn: { paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  bildirCancelText: { fontSize: 15, fontWeight: '600' },
  nfcDebugPanel: {
    backgroundColor: '#2d1f1f',
    borderBottomWidth: 2,
    borderBottomColor: '#c0392b',
    maxHeight: 180,
  },
  nfcDebugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#c0392b',
  },
  nfcDebugTitle: { fontSize: 12, fontWeight: '700', color: '#e74c3c' },
  nfcDebugClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  nfcDebugClearText: { fontSize: 12, fontWeight: '600', color: '#c0392b' },
  nfcDebugScroll: { maxHeight: 130, paddingHorizontal: 12, paddingVertical: 8 },
  nfcDebugLine: { fontSize: 11, color: '#e74c3c', marginBottom: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
