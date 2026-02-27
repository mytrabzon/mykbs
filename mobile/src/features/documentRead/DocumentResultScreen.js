/**
 * Tek belge okuma sonucu: merged (MRZ + ön yüz) alanları göster.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';

function Row({ label, value, colors }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{String(value)}</Text>
    </View>
  );
}

export default function DocumentResultScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { data, docType } = route?.params || {};
  const merged = data?.merged || data?.front || {};
  const mrz = data?.mrz ? '***' + (data.mrz.slice(-6) || '') : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Okunan belge</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Row label="Ad" value={merged.ad} colors={colors} />
          <Row label="Soyad" value={merged.soyad} colors={colors} />
          <Row label="TC Kimlik No" value={merged.kimlikNo} colors={colors} />
          <Row label="Pasaport / Belge No" value={merged.belgeNo || merged.pasaportNo} colors={colors} />
          <Row label="Doğum Tarihi" value={merged.dogumTarihi} colors={colors} />
          <Row label="Son Kullanma" value={merged.sonKullanma} colors={colors} />
          <Row label="Ülke Kodu" value={merged.ulkeKodu} colors={colors} />
          <Row label="Uyruk" value={merged.uyruk} colors={colors} />
          {mrz ? <Row label="MRZ (maske)" value={mrz} colors={colors} /> : null}
        </View>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.doneBtnText}>Tamam</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.base, paddingVertical: theme.spacing.sm },
  title: { fontSize: theme.typography.fontSize.lg, fontWeight: '600' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 40 },
  card: { borderRadius: 16, padding: theme.spacing.lg, marginBottom: theme.spacing.lg },
  row: { marginBottom: theme.spacing.sm },
  label: { fontSize: theme.typography.fontSize.sm, marginBottom: 2 },
  value: { fontSize: theme.typography.fontSize.base, fontWeight: '500' },
  doneBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '600' },
});
