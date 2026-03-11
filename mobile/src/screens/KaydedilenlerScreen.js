import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Modal,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { theme } from '../theme';
import { api } from '../services/api';
import { getApiBaseUrl } from '../config/api';

export default function KaydedilenlerScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);
  const [bildirItem, setBildirItem] = useState(null);
  const [odalar, setOdalar] = useState([]);
  const [odalarLoading, setOdalarLoading] = useState(false);
  const [bildirLoading, setBildirLoading] = useState(false);
  const [selectedOda, setSelectedOda] = useState(null);
  const [misafirTipi, setMisafirTipi] = useState('tc_vatandasi');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/okutulan-belgeler?limit=100');
      setItems(res.data?.items ?? []);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const baseUrl = getApiBaseUrl();
  const photoUrl = detail?.photoUrl && baseUrl
    ? `${baseUrl.replace(/\/$/, '')}${detail.photoUrl}`
    : null;

  useEffect(() => {
    if (!bildirItem) return;
    setOdalarLoading(true);
    setSelectedOda(null);
    api.get('/oda?filtre=bos')
      .then((res) => setOdalar(res.data?.odalar ?? []))
      .catch(() => setOdalar([]))
      .finally(() => setOdalarLoading(false));
  }, [bildirItem]);

  const handleBildir = useCallback(async () => {
    if (!bildirItem || !selectedOda) {
      Toast.show({ type: 'info', text1: 'Oda seçin', text2: 'KBS\'ye göndermek için bir oda seçin.' });
      return;
    }
    setBildirLoading(true);
    try {
      await api.post(`/okutulan-belgeler/${bildirItem.id}/bildir`, {
        odaId: selectedOda.id,
        misafirTipi,
      });
      Toast.show({ type: 'success', text1: 'KBS\'ye gönderildi', text2: `${bildirItem.ad} ${bildirItem.soyad} · Oda ${selectedOda.odaNumarasi}` });
      setBildirItem(null);
      load(true);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Bildirim gönderilemedi';
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: msg });
    } finally {
      setBildirLoading(false);
    }
  }, [bildirItem, selectedOda, misafirTipi, load]);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => setDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.ad} {item.soyad}
        </Text>
        <Text style={styles.rowMeta}>
          {item.belgeTuru === 'kimlik' ? 'Kimlik' : 'Pasaport'}
          {(item.kimlikNo || item.pasaportNo || item.belgeNo) && ` · ${item.kimlikNo || item.pasaportNo || item.belgeNo}`}
          {' · '}
          {item.createdAt ? new Date(item.createdAt).toLocaleDateString('tr-TR') : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.bildirBtn}
        onPress={(e) => { e.stopPropagation(); setBildirItem(item); }}
        hitSlop={8}
      >
        <Ionicons name="send" size={18} color={theme.colors.primary} />
        <Text style={styles.bildirBtnText}>Bildir</Text>
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kaydedilenler</Text>
        <TouchableOpacity
          style={styles.manuelBildirBtn}
          onPress={() => navigation.navigate('ManuelBildirim')}
        >
          <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.manuelBildirBtnText}>Manuel bildir</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionSubtitle}>
          Sadece kaydet ile eklenen kimlik ve pasaportlar. Check-in veya KBS gönderimi yapılmamış kayıtlar.
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={64} color={theme.colors.gray400} />
          <Text style={styles.emptyTitle}>Henüz kayıt yok</Text>
          <Text style={styles.emptyText}>
            Check-in ekranında kimlik okutup "Sadece kaydet" derseniz burada listelenir.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[theme.colors.primary]} />
          }
        />
      )}

      <Modal visible={!!detail} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDetail(null)}
        >
          <TouchableOpacity
            style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Belge detayı</Text>
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={16}>
                <Ionicons name="close" size={28} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {detail && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {photoUrl && (
                  <View style={styles.photoWrap}>
                    <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
                  </View>
                )}
                <Field label="Ad" value={detail.ad} />
                <Field label="Soyad" value={detail.soyad} />
                <Field label="Belge türü" value={detail.belgeTuru === 'kimlik' ? 'Kimlik' : 'Pasaport'} />
                <Field
                  label={detail.belgeTuru === 'kimlik' ? 'Kimlik no' : 'Pasaport no'}
                  value={detail.kimlikNo || detail.pasaportNo || detail.belgeNo}
                />
                <Field label="Doğum tarihi" value={detail.dogumTarihi} />
                <Field label="Uyruk" value={detail.uyruk} />
                <Field
                  label="Kayıt tarihi"
                  value={detail.createdAt ? new Date(detail.createdAt).toLocaleString('tr-TR') : null}
                />
                <TouchableOpacity style={styles.bildirBtnDetail} onPress={() => { setDetail(null); setBildirItem(detail); }}>
                  <Ionicons name="send" size={20} color={theme.colors.primary} />
                  <Text style={styles.bildirBtnDetailText}>KBS'ye bildir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Kapat</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!bildirItem} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setBildirItem(null)}
        >
          <TouchableOpacity
            style={[styles.modalContent, styles.bildirModal, { backgroundColor: theme.colors.surface }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>KBS'ye bildir</Text>
              <TouchableOpacity onPress={() => setBildirItem(null)} hitSlop={16}>
                <Ionicons name="close" size={28} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {bildirItem && (
              <>
                <Text style={styles.bildirSubtitle}>
                  {bildirItem.ad} {bildirItem.soyad} · Oda seçin, KBS'ye gönderilecek.
                </Text>
                <Text style={styles.inputLabel}>Misafir tipi</Text>
                <View style={styles.misafirTipiRow}>
                  {[
                    { value: 'tc_vatandasi', label: 'T.C. Vatandaşı' },
                    { value: 'ykn', label: 'YKN' },
                    { value: 'yabanci', label: 'Yabancı' },
                  ].map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.misafirTipiBtn, misafirTipi === value && styles.misafirTipiBtnActive]}
                      onPress={() => setMisafirTipi(value)}
                    >
                      <Text style={[styles.misafirTipiBtnText, misafirTipi === value && styles.misafirTipiBtnTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.inputLabel}>Oda seçin</Text>
                {odalarLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginVertical: 12 }} />
                ) : odalar.length === 0 ? (
                  <Text style={styles.emptyOdaText}>Boş oda yok. Önce Odalar ekranından oda ekleyin.</Text>
                ) : (
                  <ScrollView style={styles.odaList} nestedScrollEnabled>
                    {odalar.map((oda) => (
                      <TouchableOpacity
                        key={oda.id}
                        style={[styles.odaItem, selectedOda?.id === oda.id && styles.odaItemSelected]}
                        onPress={() => setSelectedOda(oda)}
                      >
                        <Text style={styles.odaItemText}>Oda {oda.odaNumarasi}</Text>
                        {oda.odaTipi ? <Text style={styles.odaItemMeta}>{oda.odaTipi}</Text> : null}
                        {selectedOda?.id === oda.id && <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.bildirModalActions}>
                  <TouchableOpacity
                    style={[styles.bildirSubmitBtn, { backgroundColor: theme.colors.primary }]}
                    onPress={handleBildir}
                    disabled={bildirLoading || !selectedOda}
                  >
                    {bildirLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="send" size={20} color="#fff" />
                        <Text style={styles.bildirSubmitBtnText}>KBS'ye gönder</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bildirCancelBtn} onPress={() => setBildirItem(null)}>
                    <Text style={styles.bildirCancelBtnText}>İptal</Text>
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

function Field({ label, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
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
  headerPlaceholder: { width: 40 },
  manuelBildirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.spacing.borderRadius.button,
    backgroundColor: theme.colors.primary + '18',
  },
  manuelBildirBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  section: { paddingHorizontal: theme.spacing.screenPadding, paddingTop: theme.spacing.base, marginBottom: theme.spacing.sm },
  sectionSubtitle: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing['2xl'] },
  emptyTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: theme.colors.textPrimary, marginTop: theme.spacing.lg },
  emptyText: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, textAlign: 'center', marginTop: theme.spacing.sm },
  listContent: { paddingHorizontal: theme.spacing.screenPadding, paddingBottom: theme.spacing['4xl'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.spacing.borderRadius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowMain: { flex: 1, minWidth: 0 },
  bildirBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 4,
    borderRadius: theme.spacing.borderRadius.button,
    backgroundColor: theme.colors.primary + '18',
  },
  bildirBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  bildirBtnDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.lg,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.spacing.borderRadius.button,
  },
  bildirBtnDetailText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  bildirModal: { maxHeight: '85%' },
  bildirSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: theme.spacing.lg },
  inputLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 },
  misafirTipiRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.lg },
  misafirTipiBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  misafirTipiBtnActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '15' },
  misafirTipiBtnText: { fontSize: 14, color: theme.colors.textSecondary },
  misafirTipiBtnTextActive: { color: theme.colors.primary, fontWeight: '600' },
  odaList: { maxHeight: 200, marginBottom: theme.spacing.lg },
  odaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  odaItemSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '12' },
  odaItemText: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  odaItemMeta: { fontSize: 13, color: theme.colors.textSecondary },
  emptyOdaText: { fontSize: 14, color: theme.colors.textSecondary, marginVertical: 12 },
  bildirModalActions: { gap: 10 },
  bildirSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.spacing.borderRadius.button,
  },
  bildirSubmitBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  bildirCancelBtn: { alignItems: 'center', paddingVertical: 10 },
  bildirCancelBtnText: { fontSize: 15, color: theme.colors.textSecondary },
  rowName: { fontSize: theme.typography.fontSize.base, fontWeight: '600', color: theme.colors.textPrimary },
  rowMeta: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: theme.spacing.lg },
  modalContent: { borderRadius: theme.spacing.borderRadius.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: '600', color: theme.colors.textPrimary },
  modalScroll: { maxHeight: 400, padding: theme.spacing.lg },
  photoWrap: { width: '100%', height: 140, borderRadius: theme.spacing.borderRadius.base, backgroundColor: theme.colors.gray100, marginBottom: theme.spacing.lg, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  field: { marginBottom: theme.spacing.base },
  fieldLabel: { fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary, marginBottom: 2 },
  fieldValue: { fontSize: theme.typography.fontSize.base, color: theme.colors.textPrimary },
  closeBtn: { marginTop: theme.spacing.lg, paddingVertical: theme.spacing.base, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.spacing.borderRadius.button },
  closeBtnText: { fontSize: theme.typography.fontSize.base, fontWeight: '600', color: theme.colors.primary },
});
