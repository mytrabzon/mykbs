/**
 * KBS PRIME - Aile Girişi: 5 kişiyi 30 saniyede kaydet.
 * MRZ ile tek tek tarayıp listeye ekler, oda seçip toplu check-in yapar.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { useFamilyCheckIn } from '../../context/FamilyCheckInContext';
import { api } from '../../services/api';
import { dataService } from '../../services/dataService';
import { theme, spacing } from '../../theme';

const MAX_FAMILY = 5;

export default function FamilyCheckInScreen({ route }) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { setAddMemberCallback } = useFamilyCheckIn();
  const [family, setFamily] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(route.params?.selectedOda || null);
  const [loading, setLoading] = useState(false);
  const [odalar, setOdalar] = useState([]);
  const [showRoomPicker, setShowRoomPicker] = useState(false);

  const addMember = useCallback((memberData) => {
    const p = memberData?.mrzPayload || memberData;
    const ad = (p?.givenNames || p?.ad || '').trim();
    const soyad = (p?.surname || p?.soyad || '').trim();
    const num = (p?.passportNumber || p?.kimlikNo || p?.pasaportNo || '').trim();
    const isTc = /^\d{11}$/.test(num);
    let uyruk = (p?.nationality || p?.uyruk || 'TÜRK').trim();
    setFamily((prev) => {
      if (prev.length >= MAX_FAMILY) return prev;
      // Aynı aileden ikinci kişide uyruk otomatik dolsun (otomatik tamamlama)
      if (prev.length >= 1 && (!uyruk || uyruk === 'TÜRK')) {
        uyruk = prev[0].uyruk || 'TÜRK';
      }
      const next = [
        ...prev,
        {
          id: Date.now() + Math.random(),
          ad,
          soyad,
          kimlikNo: isTc ? num : null,
          pasaportNo: !isTc ? num : null,
          dogumTarihi: p?.birthDate || p?.dogumTarihi || '',
          uyruk,
          scannedAt: new Date().toISOString(),
        },
      ];
      Toast.show({ type: 'success', text1: `${ad} ${soyad} eklendi`, text2: `${next.length}/${MAX_FAMILY} kişi` });
      return next;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setAddMemberCallback?.(addMember);
      return () => setAddMemberCallback?.(null);
    }, [addMember, setAddMemberCallback])
  );

  useEffect(() => {
    let cancelled = false;
    dataService.getOdalar('tumu', false).then((list) => {
      if (!cancelled) setOdalar(list || []);
    });
    return () => { cancelled = true; };
  }, []);

  const removeMember = (id) => {
    setFamily((prev) => prev.filter((f) => f.id !== id));
  };

  const openMrzScan = () => {
    navigation.navigate('MrzScan', { mode: 'family', fromCheckIn: true });
  };

  const openRoomSelect = () => {
    setShowRoomPicker(true);
  };

  const emptyRooms = odalar.filter((o) => !o.misafir);

  const handleComplete = async () => {
    if (!selectedRoom || family.length === 0) {
      Toast.show({ type: 'error', text1: 'Eksik', text2: 'En az bir kişi ve oda seçin.' });
      return;
    }
    setLoading(true);
    try {
      for (const member of family) {
        await api.post('/misafir/checkin', {
          odaId: selectedRoom.id,
          room_number: selectedRoom.odaNumarasi,
          ad: member.ad,
          soyad: member.soyad,
          kimlikNo: member.kimlikNo || undefined,
          pasaportNo: member.pasaportNo || undefined,
          dogumTarihi: member.dogumTarihi || undefined,
          uyruk: member.uyruk || 'TÜRK',
        });
      }
      await dataService.clearCache?.();
      Toast.show({ type: 'success', text1: 'Aile girişi tamamlandı', text2: `${family.length} kişi oda ${selectedRoom.odaNumarasi}'a yerleştirildi` });
      navigation.navigate('OdaDetay', { odaId: selectedRoom.id });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Check-in yapılamadı';
      Toast.show({ type: 'error', text1: 'Hata', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const progressPct = Math.min(100, (family.length / MAX_FAMILY) * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>👪 Aile Girişi</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: colors.primary }]} />
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          {family.length}/{MAX_FAMILY} Kişi Tarandı
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.scanArea, { backgroundColor: colors.primarySoft || colors.primary + '15', borderColor: colors.primary }]}
        onPress={openMrzScan}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={48} color={colors.primary} />
        <Text style={[styles.startScanText, { color: colors.textPrimary }]}>
          {family.length === 0 ? '📸 Aile reisini tara' : `👤 ${family.length + 1}. kişiyi tara`}
        </Text>
        <Text style={[styles.startScanHint, { color: colors.textSecondary }]}>Pasaport veya kimlik okutun</Text>
      </TouchableOpacity>

      <ScrollView style={styles.familyList} contentContainerStyle={styles.familyListContent}>
        <Text style={[styles.listTitle, { color: colors.textPrimary }]}>👪 Aile üyeleri</Text>
        {family.map((member, index) => (
          <View key={member.id} style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.memberBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.memberNumber}>{index + 1}</Text>
            </View>
            <View style={styles.memberInfo}>
              <Text style={[styles.memberName, { color: colors.textPrimary }]}>{member.ad} {member.soyad}</Text>
              <Text style={[styles.memberDoc, { color: colors.textSecondary }]}>
                {member.kimlikNo ? 'TC' : 'Pasaport'} · {member.kimlikNo || member.pasaportNo || '—'}
              </Text>
              <Text style={[styles.memberDate, { color: colors.textSecondary }]}>
                {new Date(member.scannedAt).toLocaleTimeString('tr-TR')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeMember(member.id)} style={styles.removeButton}>
              <Ionicons name="close-circle" size={24} color={colors.error || '#EF4444'} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.roomSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={openRoomSelect}
        >
          <Ionicons name="bed-outline" size={22} color={colors.primary} />
          <Text style={[styles.roomSelectorText, { color: colors.textPrimary }]}>
            {selectedRoom ? `Oda ${selectedRoom.odaNumarasi}` : 'Oda seç'}
          </Text>
        </TouchableOpacity>

      <Modal visible={showRoomPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRoomPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Oda seç</Text>
            <FlatList
              data={emptyRooms}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.roomOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedRoom(item);
                    setShowRoomPicker(false);
                  }}
                >
                  <Text style={[styles.roomOptionText, { color: colors.textPrimary }]}>Oda {item.odaNumarasi}</Text>
                  <Text style={[styles.roomOptionTip, { color: colors.textSecondary }]}>{item.odaTipi || 'Boş'}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={[styles.modalClose, { borderColor: colors.border }]} onPress={() => setShowRoomPicker(false)}>
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
        <TouchableOpacity
          style={[
            styles.completeButton,
            { backgroundColor: colors.primary },
            (!selectedRoom || family.length === 0) && styles.completeButtonDisabled,
          ]}
          disabled={!selectedRoom || family.length === 0 || loading}
          onPress={handleComplete}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.completeButtonText}>
              ✅ {family.length} kişiyi {selectedRoom ? `oda ${selectedRoom.odaNumarasi}` : 'odaya'} yerleştir
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  progressBar: {
    height: 28,
    borderRadius: 14,
    marginHorizontal: spacing.screenPadding,
    marginTop: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 14 },
  progressText: { textAlign: 'center', fontSize: 12, fontWeight: '600' },
  scanArea: {
    marginHorizontal: spacing.screenPadding,
    marginTop: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  startScanText: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  startScanHint: { fontSize: 12, marginTop: 4 },
  familyList: { flex: 1, marginTop: 16 },
  familyListContent: { paddingHorizontal: spacing.screenPadding, paddingBottom: 24 },
  listTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  memberBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberNumber: { color: '#fff', fontWeight: '700', fontSize: 14 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600' },
  memberDoc: { fontSize: 12, marginTop: 2 },
  memberDate: { fontSize: 11, marginTop: 2 },
  removeButton: { padding: 8 },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.screenPadding,
    gap: 12,
    borderTopWidth: 1,
  },
  roomSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  roomSelectorText: { fontSize: 14, fontWeight: '600' },
  completeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: { opacity: 0.5 },
  completeButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { borderRadius: 16, padding: 16, maxHeight: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  roomOption: { paddingVertical: 14, borderBottomWidth: 1 },
  roomOptionText: { fontSize: 16, fontWeight: '600' },
  roomOptionTip: { fontSize: 12, marginTop: 2 },
  modalClose: { marginTop: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 12 },
  modalCloseText: { fontSize: 14, fontWeight: '600' },
});
