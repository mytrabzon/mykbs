import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function TesisDetayScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { tesis, tesisId } = route.params || {};

  if (!tesis) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Tesis</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.body}>
          <Text style={{ color: colors.textSecondary }}>
            Tesis bilgisi bulunamadı.
            {tesisId ? ` (ID: ${tesisId})` : ''}
          </Text>
        </View>
      </View>
    );
  }

  const kotaText =
    tesis.kota != null && tesis.kullanilanKota != null
      ? `${tesis.kullanilanKota} / ${tesis.kota}`
      : '—';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {tesis.tesisAdi || 'Tesis'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{tesis.tesisAdi}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {tesis.yetkiliAdSoyad || 'Yetkili yok'} {tesis.il ? `· ${tesis.il}` : ''}
          </Text>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Telefon</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{tesis.telefon || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>E-posta</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{tesis.email || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Paket</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{tesis.paket || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Kota</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{kotaText}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Durum</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{tesis.durum || '—'}</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, marginHorizontal: 8, fontSize: 18, fontWeight: '600' },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: { fontSize: 13 },
  value: { fontSize: 14, fontWeight: '500' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});

