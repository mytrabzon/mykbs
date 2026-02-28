/**
 * Scan home: Pasaport / TR Kimlik / TR Ehliyet seçim.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { ScanDocType } from './scan.types';
import { scanLogger } from './scan.logger';
import { scanStore } from './scan.store';

const OPTIONS: { type: ScanDocType; label: string; icon: string }[] = [
  { type: 'passport', label: 'Pasaport', icon: 'passport-outline' },
  { type: 'tr_id', label: 'T.C. Kimlik', icon: 'card-outline' },
  { type: 'tr_dl', label: 'T.C. Ehliyet', icon: 'car-outline' },
];

function generateCorrelationId() {
  return `scan_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export default function ScanHome({ navigation }: { navigation: any }) {
  const { colors } = useTheme();
  const correlationId = React.useMemo(() => generateCorrelationId(), []);

  const onSelect = (docType: ScanDocType) => {
    scanStore.reset();
    scanStore.setCorrelationId(correlationId);
    scanLogger.scan_opened({ correlationId, docType });
    navigation.navigate('ScanCamera', { docType });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Text style={[styles.title, { color: colors.text }]}>Belge türünü seçin</Text>
      {OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.type}
          style={[styles.option, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => onSelect(opt.type)}
          activeOpacity={0.7}
        >
          <Ionicons name={opt.icon as any} size={32} color={colors.primary} />
          <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    marginLeft: 16,
  },
});
