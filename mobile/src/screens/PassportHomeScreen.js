/**
 * Pasaport-only modda uygulama açılış ekranı.
 * Kamera doğrudan açılmaz; kullanıcı "Pasaport oku" ile MRZ ekranına gider.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function PassportHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const openMrz = () => {
    navigation.navigate('MrzScan', { passportOnly: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="document-text-outline" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Pasaport MRZ</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Pasaportunuzun MRZ bandını okutmak için aşağıdaki butona basın.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={openMrz}
          activeOpacity={0.85}
        >
          <Ionicons name="camera-outline" size={24} color="#fff" />
          <Text style={styles.primaryBtnText}>Pasaport oku</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
