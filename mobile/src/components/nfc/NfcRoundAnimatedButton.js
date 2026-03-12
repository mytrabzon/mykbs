/**
 * Hızlı NFC sayfasında: yuvarlak, siyah, içeri-dışarı nabız animasyonlu buton.
 * Ayrı dosyada tanımlanır ki modül yükleme sırasında "doesn't exist" hatası oluşmasın.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const styles = StyleSheet.create({
  nfcBtnWrap: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 20,
  },
  nfcRoundBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  nfcBtnLabel: { fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  nfcBtnHint: { fontSize: 13, marginTop: 4, fontWeight: '500' },
});

export default function NfcRoundAnimatedButton({ onPress, disabled }) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.12, duration: 650, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.94, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scaleAnim]);
  return (
    <TouchableOpacity
      style={styles.nfcBtnWrap}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.nfcRoundBtn, { transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="hardware-chip-outline" size={40} color="#fff" />
      </Animated.View>
      <Text style={[styles.nfcBtnLabel, { color: colors.textPrimary }]}>NFC ile Okut</Text>
      <Text style={[styles.nfcBtnHint, { color: colors.textSecondary }]}>Kartı arkaya yaklaştırıp dokunun</Text>
    </TouchableOpacity>
  );
}
