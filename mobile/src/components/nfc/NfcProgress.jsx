/**
 * NFC okuma ilerleme göstergesi — aşama (init, detect, bac, dg1, dg2, complete) ve BAC ilerleme çubuğu.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const STAGE_ICONS = {
  init: '📱',
  detect: '🔍',
  bac: '🔓',
  dg1: '📄',
  dg2: '📸',
  dg7: '✍️',
  dg11: '📍',
  complete: '✅',
};

export function NfcProgress({ stage = 'init', progress = 0, message = '' }) {
  const { colors } = useTheme();
  const icon = STAGE_ICONS[stage] ?? '📋';
  const showBar = stage === 'bac' && typeof progress === 'number';

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.message, { color: colors.textPrimary }]} numberOfLines={2}>
        {message || 'NFC okunuyor...'}
      </Text>
      {showBar && (
        <View style={[styles.progressBar, { backgroundColor: colors.border + '40' }]}>
          <View style={[styles.progress, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    width: '100%',
    maxWidth: 280,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
});

export default NfcProgress;
