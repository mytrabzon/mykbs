/**
 * Oda atama / değiştir bottom sheet.
 * Filtre: Boş odalar | Tüm odalar. Arama: oda numarası. Seç → onSelect(oda).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

const FILTER_BOS = 'bos';
const FILTER_TUMU = 'tumu';

export default function OdaAtamaSheet({
  visible,
  onClose,
  onSelect,
  title = 'Oda seçin',
  currentOdaNo = null,
  onlyEmptyForBildir = false,
}) {
  const { colors } = useTheme();
  const [odalar, setOdalar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(onlyEmptyForBildir ? FILTER_BOS : FILTER_TUMU);
  const [search, setSearch] = useState('');

  const loadOdalar = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    try {
      const filtre = filter === FILTER_BOS ? 'bos' : 'tumu';
      const res = await api.get(`/oda?filtre=${filtre}`);
      setOdalar(res.data?.odalar ?? []);
    } catch (e) {
      setOdalar([]);
      setError('Odalar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [visible, filter]);

  useEffect(() => {
    if (visible) {
      setSearch('');
      loadOdalar();
    }
  }, [visible, filter, loadOdalar]);

  const searchTrim = (search || '').trim().toLowerCase();
  const filtered = searchTrim
    ? odalar.filter((o) => String(o.odaNumarasi || '').toLowerCase().includes(searchTrim))
    : odalar;

  const handleSelect = (oda) => {
    onSelect?.(oda);
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[styles.sheet, { backgroundColor: colors.surface }]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} hitSlop={16} style={styles.headerBackBtn}>
              <Ionicons name="arrow-back" size={26} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          </View>

          {currentOdaNo ? (
            <View style={[styles.currentWrap, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '40' }]}>
              <Ionicons name="bed-outline" size={18} color={colors.primary} />
              <Text style={[styles.currentText, { color: colors.textPrimary }]}>Mevcut: Oda {currentOdaNo}</Text>
            </View>
          ) : null}

          {!onlyEmptyForBildir && (
            <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.filterBtn, filter === FILTER_BOS && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                onPress={() => setFilter(FILTER_BOS)}
              >
                <Text style={[styles.filterBtnText, { color: colors.textSecondary }, filter === FILTER_BOS && { color: colors.primary, fontWeight: '600' }]}>Boş odalar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, filter === FILTER_TUMU && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                onPress={() => setFilter(FILTER_TUMU)}
              >
                <Text style={[styles.filterBtnText, { color: colors.textSecondary }, filter === FILTER_TUMU && { color: colors.primary, fontWeight: '600' }]}>Tüm odalar</Text>
              </TouchableOpacity>
            </View>
          )}

          {!onlyEmptyForBildir && odalar.length > 3 && (
            <View style={[styles.searchWrap, { backgroundColor: colors.background }]}>
              <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Oda no ara..."
                placeholderTextColor={colors.textSecondary}
                value={search}
                onChangeText={setSearch}
              />
            </View>
          )}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Odalar getiriliyor…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorWrap}>
              <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
              <TouchableOpacity style={[styles.retryBtn, { borderColor: colors.primary }]} onPress={loadOdalar}>
                <Ionicons name="refresh" size={18} color={colors.primary} />
                <Text style={[styles.retryText, { color: colors.primary }]}>Tekrar dene</Text>
              </TouchableOpacity>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="bed-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {searchTrim ? 'Arama sonucu yok.' : filter === FILTER_BOS ? 'Boş oda yok.' : 'Oda bulunamadı.'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {filtered.map((oda) => {
                const bos = oda.durum === 'bos';
                const isCurrent = currentOdaNo != null && String(oda.odaNumarasi) === String(currentOdaNo);
                return (
                  <TouchableOpacity
                    key={oda.id}
                    style={[
                      styles.odaItem,
                      { borderColor: colors.border },
                      isCurrent && { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
                    ]}
                    onPress={() => handleSelect(oda)}
                    disabled={onlyEmptyForBildir && !bos}
                  >
                    <View style={styles.odaItemLeft}>
                      <Text style={[styles.odaItemNum, { color: colors.textPrimary }]}>Oda {oda.odaNumarasi}</Text>
                      <View style={[styles.badge, bos ? { backgroundColor: colors.primary + '20' } : { backgroundColor: colors.textSecondary + '25' }]}>
                        <Text style={[styles.badgeText, { color: bos ? colors.primary : colors.textSecondary }]}>{bos ? 'Boş' : 'Dolu'}</Text>
                      </View>
                      {isCurrent && <Text style={[styles.currentBadge, { color: colors.primary }]}>Mevcut</Text>}
                    </View>
                    {(!onlyEmptyForBildir || bos) && <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  headerBackBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  currentWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  currentText: { fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  filterBtnText: { fontSize: 14 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  loadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  loadingText: { fontSize: 14 },
  errorWrap: { padding: 24, alignItems: 'center' },
  errorText: { fontSize: 14, marginBottom: 12 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: '600' },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, marginTop: 8 },
  list: { maxHeight: 320, paddingHorizontal: 20, paddingTop: 12 },
  odaItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1 },
  odaItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  odaItemNum: { fontSize: 16, fontWeight: '600' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  currentBadge: { fontSize: 12, fontWeight: '600' },
});
