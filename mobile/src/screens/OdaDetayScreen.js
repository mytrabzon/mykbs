import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { dataService } from '../services/dataService';
import Toast from 'react-native-toast-message';

function maskKimlik(no) {
  if (!no || typeof no !== 'string') return '—';
  const s = no.replace(/\D/g, '');
  if (s.length < 9) return '***';
  return s.slice(0, 3) + '*****' + s.slice(-2);
}

function maskPasaport(no) {
  if (!no || typeof no !== 'string') return '—';
  if (no.length <= 4) return '****';
  return no.slice(0, 2) + '****' + no.slice(-2);
}

function getInitials(ad, soyad) {
  const a = (ad || '').trim().charAt(0) || '';
  const s = (soyad || '').trim().charAt(0) || '';
  return (a + s).toUpperCase() || '?';
}

function getBildirimDurumLabel(durum) {
  if (durum === 'basarili') return 'Başarılı';
  if (durum === 'hatali') return 'Hatalı';
  if (durum === 'beklemede') return 'Beklemede';
  return durum || '—';
}

export default function OdaDetayScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { odaId } = route.params || {};
  const { colors } = useTheme();
  const [oda, setOda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [tekrarBildirLoading, setTekrarBildirLoading] = useState(null);
  const [topluKbsModal, setTopluKbsModal] = useState(false);
  const [topluKbsTipi, setTopluKbsTipi] = useState(''); // tc_vatandasi | ykn | yabanci
  const [topluKbsLoading, setTopluKbsLoading] = useState(false);

  const loadOdaDetay = useCallback(async () => {
    if (!odaId) return;
    try {
      const response = await api.get(`/oda/${odaId}`);
      setOda(response.data.oda);
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Oda bilgisi yüklenemedi' });
    } finally {
      setLoading(false);
    }
  }, [odaId]);

  useEffect(() => {
    loadOdaDetay();
  }, [loadOdaDetay]);

  const kalanMisafirler = (oda?.misafirler || []).filter(m => !m.cikisTarihi);

  const handleCheckoutOne = (misafir) => {
    Alert.alert(
      'Odadan Çık',
      `${misafir.ad} ${misafir.soyad} için çıkış yapılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          onPress: async () => {
            try {
              await api.post(`/misafir/checkout/${misafir.id}`);
              await dataService.clearCache();
              Toast.show({ type: 'success', text1: 'Çıkış yapıldı' });
              loadOdaDetay();
              if (kalanMisafirler.length <= 1) navigation.goBack();
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Hata', text2: err?.response?.data?.message || 'Çıkış yapılamadı' });
            }
          },
        },
      ]
    );
  };

  const handleCheckoutAll = () => {
    if (kalanMisafirler.length === 0) {
      Alert.alert('Hata', 'Bu odada aktif misafir yok');
      return;
    }
    Alert.alert(
      'Toplu Odadan Çık',
      `Odadaki ${kalanMisafirler.length} kişi için çıkış yapılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hepsini Çıkart',
          onPress: async () => {
            try {
              for (const m of kalanMisafirler) {
                await api.post(`/misafir/checkout/${m.id}`);
              }
              await dataService.clearCache();
              Toast.show({ type: 'success', text1: 'Tüm çıkışlar yapıldı' });
              navigation.goBack();
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Hata', text2: err?.response?.data?.message || 'Çıkış yapılamadı' });
            }
          },
        },
      ]
    );
  };

  const handleTekrarBildir = async (bildirimId) => {
    if (tekrarBildirLoading) return;
    setTekrarBildirLoading(bildirimId);
    try {
      await api.post(`/bildirim/${bildirimId}/tekrar-dene`);
      Toast.show({ type: 'success', text1: 'Bildirim tekrar gönderildi' });
      loadOdaDetay();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Hata', text2: err?.response?.data?.message || 'Bildirim gönderilemedi' });
    } finally {
      setTekrarBildirLoading(null);
    }
  };

  const openEditModal = (misafir) => {
    setEditModal({
      id: misafir.id,
      ad: misafir.ad || '',
      soyad: misafir.soyad || '',
      dogumTarihi: misafir.dogumTarihi ? new Date(misafir.dogumTarihi).toISOString().slice(0, 10) : '',
      uyruk: misafir.uyruk || '',
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setSavingEdit(true);
    try {
      await api.put(`/misafir/${editModal.id}`, {
        ad: editModal.ad,
        ad2: editModal.ad2 || undefined,
        soyad: editModal.soyad,
        dogumTarihi: editModal.dogumTarihi || undefined,
        uyruk: editModal.uyruk || undefined,
        misafirTipi: editModal.misafirTipi || undefined,
      });
      Toast.show({ type: 'success', text1: 'Misafir güncellendi' });
      setEditModal(null);
      loadOdaDetay();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Hata', text2: err?.response?.data?.message || 'Güncellenemedi' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleTopluKbsGonder = async () => {
    if (!topluKbsTipi || kalanMisafirler.length === 0) {
      Toast.show({ type: 'error', text1: 'Misafir tipi seçin', text2: 'Jandarma/Polis bildirimi için T.C. Vatandaşı, YKN veya Yabancı seçin.' });
      return;
    }
    setTopluKbsLoading(true);
    try {
      const response = await api.post('/bildirim/toplu-gonder', {
        misafirIds: kalanMisafirler.map((m) => m.id),
        misafirTipi: topluKbsTipi,
      });
      Toast.show({
        type: 'success',
        text1: 'Toplu bildirim',
        text2: response.data?.message || `${response.data?.basarili ?? 0} başarılı, ${response.data?.hatali ?? 0} hatalı`,
      });
      setTopluKbsModal(false);
      setTopluKbsTipi('');
      loadOdaDetay();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Hata', text2: err?.response?.data?.message || 'Toplu bildirim gönderilemedi' });
    } finally {
      setTopluKbsLoading(false);
    }
  };

  const handleDeleteOda = () => {
    if (kalanMisafirler.length > 0) {
      Alert.alert('Silinemez', 'Dolu oda silinemez. Önce tüm misafir çıkışı yapın.');
      return;
    }
    Alert.alert(
      'Odayı Sil',
      `"Oda ${oda.odaNumarasi}" kalıcı olarak silinecek. Emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/oda/${odaId}`);
              await dataService.clearCache();
              Toast.show({ type: 'success', text1: 'Oda silindi' });
              navigation.goBack();
            } catch (err) {
              const msg = err?.response?.data?.message || err?.message || 'Oda silinemedi';
              Toast.show({ type: 'error', text1: 'Hata', text2: msg });
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!oda) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Oda bulunamadı</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Oda {oda.odaNumarasi}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{oda.odaTipi} · {oda.kapasite} Kişi</Text>

        {kalanMisafirler.length > 0 ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Kalan kişiler</Text>
              <View style={styles.sectionRowButtons}>
                <TouchableOpacity
                  style={[styles.topluCikBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => { setTopluKbsTipi(''); setTopluKbsModal(true); }}
                >
                  <Ionicons name="notifications-outline" size={18} color={colors.primary} />
                  <Text style={[styles.topluCikBtnText, { color: colors.primary }]}>Toplu KBS gönder</Text>
                </TouchableOpacity>
                {kalanMisafirler.length > 1 && (
                  <TouchableOpacity
                    style={[styles.topluCikBtn, { backgroundColor: colors.error + '20' }]}
                    onPress={handleCheckoutAll}
                  >
                    <Ionicons name="log-out-outline" size={18} color={colors.error} />
                    <Text style={[styles.topluCikBtnText, { color: colors.error }]}>Toplu odadan çık</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {kalanMisafirler.map((m) => {
              const sonBildirim = m.bildirimler?.[0];
              const bildirimId = sonBildirim?.id;
              return (
                <View key={m.id} style={[styles.misafirCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.misafirRow}>
                    <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials(m.ad, m.soyad)}</Text>
                    </View>
                    <View style={styles.misafirInfo}>
                      <Text style={[styles.guestName, { color: colors.textPrimary }]}>{[m.ad, m.ad2, m.soyad].filter(Boolean).join(' ')}</Text>
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Kimlik: {maskKimlik(m.kimlikNo)} · Pasaport: {maskPasaport(m.pasaportNo)}
                      </Text>
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Doğum: {m.dogumTarihi ? new Date(m.dogumTarihi).toLocaleDateString('tr-TR') : '—'} · Uyruk: {m.uyruk || '—'}
                      </Text>
                      <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Giriş: {new Date(m.girisTarihi).toLocaleDateString('tr-TR')}
                      </Text>
                      {sonBildirim && (
                        <View style={styles.bildirimRow}>
                          <Ionicons
                            name={sonBildirim.durum === 'basarili' ? 'checkmark-circle' : sonBildirim.durum === 'hatali' ? 'warning' : 'time'}
                            size={14}
                            color={sonBildirim.durum === 'basarili' ? colors.success : sonBildirim.durum === 'hatali' ? colors.error : colors.textSecondary}
                          />
                          <Text style={[styles.bildirimText, { color: colors.textSecondary }]}>
                            Bildirim: {getBildirimDurumLabel(sonBildirim.durum)} · {new Date(sonBildirim.createdAt).toLocaleString('tr-TR')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: colors.error + '20' }]}
                      onPress={() => handleCheckoutOne(m)}
                    >
                      <Ionicons name="log-out-outline" size={16} color={colors.error} />
                      <Text style={[styles.smallBtnText, { color: colors.error }]}>Odadan çık</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => openEditModal(m)}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                      <Text style={[styles.smallBtnText, { color: colors.primary }]}>Düzenle</Text>
                    </TouchableOpacity>
                    {bildirimId && (
                      <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: colors.primary + '20' }]}
                        onPress={() => handleTekrarBildir(bildirimId)}
                        disabled={!!tekrarBildirLoading}
                      >
                        {tekrarBildirLoading === bildirimId ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="notifications-outline" size={16} color={colors.primary} />
                            <Text style={[styles.smallBtnText, { color: colors.primary }]}>Tekrar bildir</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bed-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Oda boş</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.deleteButton,
            { backgroundColor: kalanMisafirler.length > 0 ? colors.border : '#d32f2f' },
          ]}
          onPress={handleDeleteOda}
          disabled={kalanMisafirler.length > 0}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteButtonText}>Odayı Sil</Text>
        </TouchableOpacity>
      </View>

      {/* Toplu KBS gönder modalı — tek seferlik misafir tipi seçimi, odadaki tüm misafirlere uygulanır */}
      <Modal visible={topluKbsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Toplu KBS gönder</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary, marginBottom: 12 }]}>
              Bu odadaki {kalanMisafirler.length} kişi Jandarma/Polis'e bildirilecek. Aşağıdaki misafir tipi hepsi için geçerli olacak.
            </Text>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Misafir tipi</Text>
            <View style={styles.misafirTipiRow}>
              {[
                { value: 'tc_vatandasi', label: 'T.C. Vatandaşı' },
                { value: 'ykn', label: 'YKN' },
                { value: 'yabanci', label: 'Yabancı' },
              ].map(({ value, label }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.misafirTipiBtn,
                    topluKbsTipi === value && styles.misafirTipiBtnActive,
                  ]}
                  onPress={() => setTopluKbsTipi(value)}
                >
                  <Text style={[styles.misafirTipiBtnText, topluKbsTipi === value && styles.misafirTipiBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => { setTopluKbsModal(false); setTopluKbsTipi(''); }}
              >
                <Text style={{ color: colors.textPrimary }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleTopluKbsGonder}
                disabled={topluKbsLoading || !topluKbsTipi}
              >
                {topluKbsLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalBtnPrimaryText}>Gönder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Düzenleme modalı */}
      <Modal visible={!!editModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Misafir düzenle</Text>
            {editModal && (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="1. Ad"
                  placeholderTextColor={colors.textSecondary}
                  value={editModal.ad}
                  onChangeText={(t) => setEditModal((p) => ({ ...p, ad: t }))}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="2. Ad"
                  placeholderTextColor={colors.textSecondary}
                  value={editModal.ad2}
                  onChangeText={(t) => setEditModal((p) => ({ ...p, ad2: t }))}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="Soyad"
                  placeholderTextColor={colors.textSecondary}
                  value={editModal.soyad}
                  onChangeText={(t) => setEditModal((p) => ({ ...p, soyad: t }))}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="Doğum (YYYY-MM-DD)"
                  placeholderTextColor={colors.textSecondary}
                  value={editModal.dogumTarihi}
                  onChangeText={(t) => setEditModal((p) => ({ ...p, dogumTarihi: t }))}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="Uyruk"
                  placeholderTextColor={colors.textSecondary}
                  value={editModal.uyruk}
                  onChangeText={(t) => setEditModal((p) => ({ ...p, uyruk: t }))}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 8 }]}>Misafir tipi (KBS)</Text>
                <View style={styles.misafirTipiRow}>
                  {[
                    { value: 'tc_vatandasi', label: 'T.C. Vatandaşı' },
                    { value: 'ykn', label: 'YKN' },
                    { value: 'yabanci', label: 'Yabancı' },
                  ].map(({ value, label }) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.misafirTipiBtn, editModal.misafirTipi === value && styles.misafirTipiBtnActive]}
                      onPress={() => setEditModal((p) => ({ ...p, misafirTipi: value }))}
                    >
                      <Text style={[styles.misafirTipiBtnText, editModal.misafirTipi === value && styles.misafirTipiBtnTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border }]} onPress={() => setEditModal(null)}>
                <Text style={{ color: colors.textPrimary }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={saveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Kaydet</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8 },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
  sectionRowButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  topluCikBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  misafirTipiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  misafirTipiBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.06)', borderWidth: 1, borderColor: 'transparent' },
  misafirTipiBtnActive: { backgroundColor: 'rgba(76, 175, 80, 0.15)', borderColor: '#4CAF50' },
  misafirTipiBtnText: { fontSize: 14, color: '#666' },
  misafirTipiBtnTextActive: { color: '#2E7D32', fontWeight: '600' },
  inputLabel: { fontSize: 14, marginBottom: 4 },
  topluCikBtnText: { fontSize: 13, fontWeight: '600' },
  misafirCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  misafirRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '700' },
  misafirInfo: { flex: 1 },
  guestName: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  infoText: { fontSize: 13, marginBottom: 2 },
  bildirimRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  bildirimText: { fontSize: 12 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 },
  smallBtnText: { fontSize: 12, fontWeight: '600' },
  emptyCard: { borderRadius: 16, borderWidth: 1, padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 16 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 14,
    marginTop: 24,
  },
  deleteButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalBox: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '600' },
});
