import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

/**
 * Kalan kredi uyarıları (agresif değil):
 * - Son 20: nazik
 * - 15: sarı banner "Kalan bildirimin: 15"
 * - 5: belirgin "Bildirimlerin bitmek üzere."
 * 0'da banner göstermiyoruz; PaywallModal açılır.
 */
export default function CreditsBanner() {
  const { tesis } = useAuth();
  const { colors } = useTheme();

  if (!tesis || tesis.kota == null) return null;

  const used = tesis.kullanilanKota ?? 0;
  const kalan = Math.max(0, tesis.kota - used);

  if (kalan <= 0) return null;

  if (kalan <= 5) {
    return (
      <View style={[styles.banner, styles.prominent, { backgroundColor: colors.errorSoft, borderColor: colors.error }]}>
        <Text style={[styles.text, styles.prominentText, { color: colors.error }]}>
          Bildirimlerin bitmek üzere.
        </Text>
      </View>
    );
  }

  if (kalan <= 15) {
    return (
      <View style={[styles.banner, styles.yellow, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}>
        <Text style={[styles.text, { color: colors.textPrimary }]}>
          Kalan bildirimin: <Text style={styles.bold}>{kalan}</Text>
        </Text>
      </View>
    );
  }

  if (kalan <= 20) {
    return (
      <View style={[styles.banner, styles.gentle, { backgroundColor: colors.primarySoft, borderColor: colors.border }]}>
        <Text style={[styles.smallText, { color: colors.textSecondary }]}>
          Kalan bildirim: {kalan}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  gentle: {
    paddingVertical: 8,
  },
  yellow: {},
  prominent: {
    paddingVertical: 12,
  },
  text: {
    fontSize: 15,
    textAlign: 'center',
  },
  prominentText: {
    fontWeight: '600',
  },
  smallText: {
    fontSize: 13,
    textAlign: 'center',
  },
  bold: {
    fontWeight: '700',
  },
});
