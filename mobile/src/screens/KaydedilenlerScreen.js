import React, { useState, useCallback } from 'react';
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
import { theme } from '../theme';
import { api } from '../services/api';
import { getApiBaseUrl } from '../config/api';

export default function KaydedilenlerScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);

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
        <View style={styles.headerPlaceholder} />
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
                <TouchableOpacity style={styles.closeBtn} onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Kapat</Text>
                </TouchableOpacity>
              </ScrollView>
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
  rowMain: { flex: 1 },
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
