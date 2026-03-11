/**
 * NFC okuma sonucu — tam kart: foto, ad/soyad, belge no, doğum, uyruk.
 * Oda Seç, Bildir, Kaydet butonları.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/apiSupabase';

const CARD_PHOTO_SIZE = 96;

export default function NfcResultScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const data = route?.params?.data ?? null;
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [odaNo, setOdaNo] = useState(null);
  const [odaModal, setOdaModal] = useState(false);
  const [bildirModal, setBildirModal] = useState(false);
  const [odalar, setOdalar] = useState([]);
  const [odalarLoading, setOdalarLoading] = useState(false);
  const [selectedOda, setSelectedOda] = useState(null);
  const [misafirTipi, setMisafirTipi] = useState('tc_vatandasi');
  const [bildirLoading, setBildirLoading] = useState(false);

  const belgeId = savedId || data?.id;
  const docNo = (data?.kimlikNo || data?.pasaportNo || data?.belgeNo || '').trim();
  const isTc = /^\d{11}$/.test(docNo);
  const photoUri = data?.chipPhotoBase64
    ? `data:image/jpeg;base64,${data.chipPhotoBase64}`
    : null;

  const loadOdalar = useCallback(() => {
    setOdalarLoading(true);
    setSelectedOda(null);
    api
      .get('/oda?filtre=tumu')
      .then((res) => setOdalar(res.data?.odalar ?? []))
      .catch(() => setOdalar([]))
      .finally(() => setOdalarLoading(false));
  }, []);

  const openOdaModal = useCallback(() => {
    if (!belgeId) {
      Toast.show({ type: 'info', text1: 'Önce kaydedin', text2: 'Oda atamak için "Kaydet"e basın.' });
      return;
    }
    loadOdalar();
    setOdaModal(true);
  }, [belgeId, loadOdalar]);

  const openBildirModal = useCallback(() => {
    if (!belgeId) {
      Toast.show({ type: 'info', text1: 'Önce kaydedin', text2: 'Bildirim için "Kaydet"e basın.' });
      return;
    }
    loadOdalar();
    setSelectedOda(null);
    setBildirModal(true);
  }, [belgeId, loadOdalar]);

  const handleKaydet = useCallback(async () => {
    if (!data?.ad && !data?.soyad) {
      Toast.show({ type: 'error', text1: 'Eksik bilgi', text2: 'Ad ve soyad okunamadı.' });
      return;
    }
    const ad = (data.ad || '').trim() || '—';
    const soyad = (data.soyad || '').trim() || '—';
    setSaving(true);
    try {
      const body = {
        belgeTuru: (data.type === 'id_card' || isTc) ? 'kimlik' : 'pasaport',
        ad,
        soyad,
        kimlikNo: isTc ? docNo : null,
        pasaportNo: !isTc ? docNo : null,
        belgeNo: docNo || null,
        dogumTarihi: data.dogumTarihi || null,
        uyruk: (data.uyruk || 'TÜRK').trim(),
      };
      if (data.chipPhotoBase64) body.portraitPhotoBase64 = data.chipPhotoBase64;
      const res = await api.post('/okutulan-belgeler', body);
      const id = res.data?.id;
      if (id) {
        setSavedId(id);
        Toast.show({ type: 'success', text1: 'Kaydedildi', text2: 'Oda seçebilir veya bildir gönderebilirsiniz.' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: e?.response?.data?.message || 'Tekrar deneyin.' });
    } finally {
      setSaving(false);
    }
  }, [data, docNo, isTc]);

  const handleOdaSec = useCallback(async () => {
    if (!belgeId || !selectedOda) {
      Toast.show({ type: 'info', text1: 'Oda seçin' });
      return;
    }
    setOdalarLoading(true);
    try {
      await api.put(`/okutulan-belgeler/${belgeId}/oda`, { odaId: selectedOda.id });
      setOdaNo(selectedOda.odaNumarasi);
      setOdaModal(false);
      Toast.show({ type: 'success', text1: 'Oda atandı', text2: `Oda ${selectedOda.odaNumarasi}` });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Atanmadı', text2: e?.response?.data?.message || 'Tekrar deneyin.' });
    } finally {
      setOdalarLoading(false);
    }
  }, [belgeId, selectedOda]);

  const handleBildir = useCallback(async () => {
    if (!belgeId || !selectedOda) {
      Toast.show({ type: 'info', text1: 'Oda seçin', text2: 'KBS\'ye göndermek için oda seçin.' });
      return;
    }
    setBildirLoading(true);
    try {
      await api.post(`/okutulan-belgeler/${belgeId}/bildir`, {
        odaId: selectedOda.id,
        misafirTipi,
      });
      setBildirModal(false);
      setOdaNo(selectedOda.odaNumarasi);
      Toast.show({ type: 'success', text1: 'KBS\'ye gönderildi', text2: `Oda ${selectedOda.odaNumarasi}` });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: e?.response?.data?.message || 'Tekrar deneyin.' });
    } finally {
      setBildirLoading(false);
    }
  }, [belgeId, selectedOda, misafirTipi]);

  const goToKaydedilenler = useCallback(() => {
    navigation.replace('Kaydedilenler');
  }, [navigation]);

  if (!data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>Veri bulunamadı</Text>
        <TouchableOpacity style={[styles.backBtnBig, { borderColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={[styles.backBtnBigText, { color: colors.primary }]}>Geri</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const adSoyad = [data.ad, data.soyad].filter(Boolean).join(' ').trim() || '—';
  const docLabel = isTc ? 'TC' : 'Pasaport';
  const sadeceUyrukGorunuyor = (adSoyad === '—' && !docNo && !data.dogumTarihi);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>NFC Okundu</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.badge, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>NFC OKUNDU!</Text>
          </View>

          <View style={styles.cardRow}>
            <View style={[styles.photoWrap, { backgroundColor: colors.border + '40' }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
              ) : (
                <Ionicons name="person" size={40} color={colors.textSecondary} />
              )}
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>
                👤 {adSoyad}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                🆔 {docNo || '—'} ({docLabel})
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                📅 {data.dogumTarihi || '—'}
              </Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                🌍 {data.uyruk || 'TÜRK'}
              </Text>
              {data.ikametAdresi ? (
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  📍 {data.ikametAdresi}
                </Text>
              ) : null}
              {photoUri ? (
                <Text style={[styles.photoLabel, { color: colors.textSecondary }]}>📸 Fotoğraf mevcut</Text>
              ) : null}
              {sadeceUyrukGorunuyor ? (
                <Text style={[styles.hint, { color: colors.textSecondary, marginTop: 8 }]}>
                  Ad, belge no ve doğum tarihi çipten okunamadı. Tekrar deneyin.
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.actions, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={openOdaModal}
              activeOpacity={0.8}
            >
              <Ionicons name="bed-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Oda Seç</Text>
              {odaNo ? <Text style={[styles.odaBadge, { color: colors.primary }]}>{odaNo}</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border }]}
              onPress={openBildirModal}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={20} color={colors.primary} />
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Bildir</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleKaydet}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#fff" />
                  <Text style={styles.actionBtnPrimaryText}>{savedId ? 'Kaydedildi' : 'Kaydet'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {savedId && (
          <TouchableOpacity style={[styles.linkBtn, { borderColor: colors.primary }]} onPress={goToKaydedilenler}>
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={[styles.linkBtnText, { color: colors.primary }]}>Kaydedilenler sayfasına git</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Oda seç modal */}
      <Modal visible={odaModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOdaModal(false)}>
          <TouchableOpacity style={[styles.modalSheet, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Oda seç</Text>
            {odalarLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
            ) : (
              <ScrollView style={styles.odaList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {odalar.filter((o) => o.durum === 'bos').map((oda) => (
                  <TouchableOpacity
                    key={oda.id}
                    style={[
                      styles.odaItem,
                      { borderColor: colors.border },
                      selectedOda?.id === oda.id && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
                    ]}
                    onPress={() => setSelectedOda(oda)}
                  >
                    <Text style={[styles.odaItemText, { color: colors.textPrimary }]}>Oda {oda.odaNumarasi}</Text>
                    {selectedOda?.id === oda.id ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={handleOdaSec} disabled={!selectedOda || odalarLoading}>
                <Text style={styles.modalBtnText}>Ata</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnOutline, { borderColor: colors.border }]} onPress={() => setOdaModal(false)}>
                <Text style={[styles.modalBtnOutlineText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Bildir modal */}
      <Modal visible={bildirModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setBildirModal(false)}>
          <TouchableOpacity style={[styles.modalSheet, { backgroundColor: colors.surface }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>KBS'ye bildir</Text>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Misafir tipi</Text>
            <View style={styles.misafirTipiRow}>
              {[
                { value: 'tc_vatandasi', label: 'T.C.' },
                { value: 'ykn', label: 'YKN' },
                { value: 'yabanci', label: 'Yabancı' },
              ].map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.misafirTipiBtn,
                    { borderColor: colors.border },
                    misafirTipi === value && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
                  ]}
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
                    style={[
                      styles.odaItem,
                      { borderColor: colors.border },
                      selectedOda?.id === oda.id && { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
                    ]}
                    onPress={() => setSelectedOda(oda)}
                  >
                    <Text style={[styles.odaItemText, { color: colors.textPrimary }]}>Oda {oda.odaNumarasi}</Text>
                    {selectedOda?.id === oda.id ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleBildir}
                disabled={!selectedOda || bildirLoading}
              >
                {bildirLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnText}>Gönder</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnOutline, { borderColor: colors.border }]} onPress={() => setBildirModal(false)}>
                <Text style={[styles.modalBtnOutlineText, { color: colors.textSecondary }]}>İptal</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { fontSize: 16, marginBottom: 16 },
  backBtnBig: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, borderWidth: 2 },
  backBtnBigText: { fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  badgeText: { fontSize: 14, fontWeight: '700' },
  cardRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  photoWrap: {
    width: CARD_PHOTO_SIZE,
    height: CARD_PHOTO_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  cardInfo: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 13, marginBottom: 2 },
  photoLabel: { fontSize: 12, marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 14, fontWeight: '600' },
  odaBadge: { fontSize: 12, fontWeight: '700' },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  actionBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  linkBtnText: { fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  misafirTipiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  misafirTipiBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  misafirTipiBtnText: { fontSize: 14 },
  odaList: { maxHeight: 220, marginBottom: 16 },
  odaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  odaItemText: { fontSize: 16, fontWeight: '600' },
  modalActions: { gap: 10 },
  modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  modalBtnOutline: { paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  modalBtnOutlineText: { fontSize: 15, fontWeight: '600' },
});
