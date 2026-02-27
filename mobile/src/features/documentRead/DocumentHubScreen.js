/**
 * Havalimanı tarzı belge okuma hub'ı:
 * Kimlik / Ehliyet / Pasaport — Kamera (MRZ arka), Kamera (ön yüz), Galeriden tek, Galeriden toplu (5–10).
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';

const DOC_TYPES = [
  { key: 'kimlik', label: 'Kimlik', icon: 'card-outline' },
  { key: 'ehliyet', label: 'Ehliyet', icon: 'car-outline' },
  { key: 'pasaport', label: 'Pasaport', icon: 'airplane-outline' },
];

const ACTIONS = [
  { key: 'mrz', label: 'Kamera ile MRZ (arka)', desc: 'Arka yüz MRZ çizgisi – sürekli tarama', icon: 'camera', route: 'MrzScan' },
  { key: 'front', label: 'Kamera ile ön yüz', desc: 'Ön yüz fotoğrafı – ad, soyad, TC, tarih', icon: 'document-text', route: 'FrontDocumentScan' },
  { key: 'gallery', label: 'Galeriden tek belge', desc: 'Tek fotoğraf seçip okut', icon: 'image', route: 'GallerySingleDocument' },
  { key: 'batch', label: 'Galeriden toplu (5–10)', desc: '5–10 fotoğraf seçip toplu okut', icon: 'images', route: 'GalleryBatchDocument' },
];

export default function DocumentHubScreen({ navigation }) {
  const { colors } = useTheme();
  const [docType, setDocType] = useState('kimlik');

  const handleAction = useCallback(
    (action) => {
      if (action.route === 'MrzScan') {
        navigation.navigate('MrzScan');
        return;
      }
      if (action.route === 'FrontDocumentScan') {
        navigation.navigate('FrontDocumentScan', { docType });
        return;
      }
      if (action.route === 'GallerySingleDocument') {
        navigation.navigate('GallerySingleDocument', { docType });
        return;
      }
      if (action.route === 'GalleryBatchDocument') {
        navigation.navigate('GalleryBatchDocument', { docType });
        return;
      }
    },
    [navigation, docType]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Belge oku</Text>
        <View style={styles.iconBtn} />
      </View>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Havalimanı tarzı: nokta atışı veri. Kimlik, ehliyet veya pasaport – kamera veya galeri.
      </Text>

      <View style={[styles.docTypeRow, { backgroundColor: colors.surface }]}>
        {DOC_TYPES.map((d) => (
          <TouchableOpacity
            key={d.key}
            style={[styles.docTypeBtn, docType === d.key && { backgroundColor: colors.primary }]}
            onPress={() => setDocType(d.key)}
          >
            <Ionicons name={d.icon} size={22} color={docType === d.key ? '#fff' : colors.textSecondary} />
            <Text style={[styles.docTypeLabel, { color: docType === d.key ? '#fff' : colors.textPrimary }]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.key}
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => handleAction(action)}
            activeOpacity={0.8}
          >
            <View style={[styles.cardIconWrap, { backgroundColor: colors.primarySoft || '#E8F0FE' }]}>
              <Ionicons name={action.icon} size={32} color={colors.primary} />
            </View>
            <View style={styles.cardBody}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{action.label}</Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{action.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm },
  title: { fontSize: theme.typography.fontSize.xl, fontWeight: theme.typography.fontWeight.bold },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  subtitle: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.base, fontSize: theme.typography.fontSize.sm },
  docTypeRow: { flexDirection: 'row', marginHorizontal: theme.spacing.lg, borderRadius: 12, padding: 4 },
  docTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  docTypeLabel: { fontSize: theme.typography.fontSize.sm, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.base,
    borderRadius: 16,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.base },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: theme.typography.fontSize.base, fontWeight: '600', marginBottom: 2 },
  cardDesc: { fontSize: theme.typography.fontSize.sm, opacity: 0.85 },
});
