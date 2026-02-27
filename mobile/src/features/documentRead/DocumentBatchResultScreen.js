/**
 * Toplu belge okuma sonuçları listesi.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { theme } from '../../theme';

export default function DocumentBatchResultScreen({ navigation, route }) {
  const { colors } = useTheme();
  const { results = [] } = route?.params || {};
  const successCount = results.filter((r) => r.success).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Toplu sonuç</Text>
        <View style={styles.iconBtn} />
      </View>
      <Text style={[styles.summary, { color: colors.textSecondary }]}>
        {successCount}/{results.length} belge okundu
      </Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {results.map((r, i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Belge #{i + 1}</Text>
              {r.success ? (
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              ) : (
                <Ionicons name="close-circle" size={24} color={colors.error} />
              )}
            </View>
            {r.success && r.merged ? (
              <>
                <Text style={[styles.line, { color: colors.textPrimary }]}>
                  {[r.merged.soyad, r.merged.ad].filter(Boolean).join(' ') || '–'}
                </Text>
                <Text style={[styles.lineSmall, { color: colors.textSecondary }]}>
                  TC: {r.merged.kimlikNo || '–'}  Belge: {r.merged.belgeNo || r.merged.pasaportNo || '–'}
                </Text>
                <Text style={[styles.lineSmall, { color: colors.textSecondary }]}>
                  Doğum: {r.merged.dogumTarihi || '–'}  Bitiş: {r.merged.sonKullanma || '–'}
                </Text>
              </>
            ) : (
              <Text style={[styles.lineSmall, { color: colors.error }]}>{r.error || 'Okunamadı'}</Text>
            )}
          </View>
        ))}
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
  summary: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm, fontSize: theme.typography.fontSize.sm },
  scroll: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 40 },
  card: { borderRadius: 12, padding: theme.spacing.base, marginBottom: theme.spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: theme.typography.fontSize.base, fontWeight: '600' },
  line: { fontSize: theme.typography.fontSize.base, marginBottom: 2 },
  lineSmall: { fontSize: theme.typography.fontSize.sm, marginTop: 2 },
  doneBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: theme.spacing.base },
  doneBtnText: { color: '#fff', fontWeight: '600' },
});
