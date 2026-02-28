/**
 * Tek Okuma sekmesi: Kimlik/Pasaport (kamera + MRZ) ve NFC ayrı seçenekler.
 * Tab menüde "Okuma" ile bu ekran açılır; tek ekranda hem kimlik hem pasaport okunur (MRZ).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../theme';

export default function OkumaScreen({ navigation }) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Belge okuma</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Kimlik veya pasaportu kamerayla tarayın veya NFC ile okuyun.
        </Text>
      </View>
      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => navigation.navigate('DocumentHub')}
          activeOpacity={0.8}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: colors.primarySoft || '#E8F0FE' }]}>
            <Ionicons name="document-text" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Tam belge okuma</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Ön yüz kamera, galeriden tek veya 5–10’lu toplu okutma. MRZ tarama için tab menüdeki "MRZ Tara" sekmesini kullanın.
          </Text>
          <View style={styles.cardArrow}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => navigation.navigate('NfcIntro')}
          activeOpacity={0.8}
        >
          <View style={[styles.cardIconWrap, { backgroundColor: colors.successSoft || '#E6F4EA' }]}>
            <Ionicons name="phone-portrait-outline" size={40} color={colors.success} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>NFC ile oku</Text>
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
            Pasaport çipine telefonu yaklaştırarak güvenli okuma.
          </Text>
          <View style={styles.cardArrow}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.base },
  title: { fontSize: theme.typography.fontSize.xxl || 24, fontWeight: theme.typography.fontWeight.bold, marginBottom: theme.spacing.xs },
  subtitle: { fontSize: theme.typography.fontSize.base },
  cards: { flex: 1, paddingHorizontal: theme.spacing.lg, gap: theme.spacing.base },
  card: {
    borderRadius: 20,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIconWrap: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.base },
  cardTitle: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.semibold, marginBottom: 2 },
  cardDesc: { fontSize: theme.typography.fontSize.sm, flex: 1 },
  cardArrow: { marginLeft: theme.spacing.sm },
});
