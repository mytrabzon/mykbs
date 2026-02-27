import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCredits } from '../context/CreditsContext';
import { Ionicons } from '@expo/vector-icons';
import { WELCOME_TRIAL_MESSAGE } from '../constants/packages';

/**
 * Deneme kullanıcısına bir kez gösterilen hoş geldin mesajı.
 * "Hoş geldiniz! 3 gün boyunca 100 oda bildirimi ücretsiz."
 */
export default function TrialWelcomeBanner() {
  const { tesis } = useAuth();
  const { colors } = useTheme();
  const { showWelcomeTrial, dismissWelcomeTrial } = useCredits();

  if (!showWelcomeTrial || !tesis) return null;

  const trialEnded =
    tesis.paket === 'deneme' &&
    tesis.trialEndsAt &&
    new Date(tesis.trialEndsAt) < new Date();
  if (trialEnded) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
      <Text style={[styles.text, { color: colors.textPrimary }]}>{WELCOME_TRIAL_MESSAGE}</Text>
      <TouchableOpacity onPress={dismissWelcomeTrial} style={styles.close} hitSlop={12}>
        <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  close: {
    padding: 4,
  },
});
