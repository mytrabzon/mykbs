/**
 * Müşteriler (B2B) — Tüm bilgiler uygulama içinde. API hazır olduğunda liste burada gösterilecek.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function MusterilerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={[styles.backBtn, styles.backBtnLeft]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Müşteriler (B2B)</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Ionicons name="people-outline" size={56} color={colors.primary} />
        </View>
        <Text style={[styles.message, { color: colors.textPrimary }]}>Müşteriler (B2B)</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Henüz kayıt yok. Liste burada görüntülenecektir.
        </Text>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  backBtnLeft: { marginLeft: -44 },
  title: { fontSize: 18, fontWeight: '600' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  message: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, textAlign: 'center', paddingHorizontal: 16 },
});
