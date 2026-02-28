/**
 * Scan review: çekilen görüntü + parse sonucu. Onayla / Düzelt / Yeniden Çek.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import type { ScanDocType } from './scan.types';
import { scanLogger } from './scan.logger';
import { scanStore } from './scan.store';
import { getLastScanEvents } from './scan.logger';

export default function ScanReviewScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const docType = (route.params?.docType || 'passport') as ScanDocType;
  const imageBase64 = route.params?.imageBase64 as string | undefined;
  const result = route.params?.result as {
    mrz?: { ok: boolean; confidence: number; fields: Record<string, string>; checks?: Record<string, boolean> };
    doc?: { ok: boolean; confidence: number; fields: Record<string, unknown> };
  } | undefined;
  const correlationId = (route.params?.correlationId || scanStore.getState().correlationId) as string | undefined;
  const { colors } = useTheme();
  const [showDebug, setShowDebug] = useState(false);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const { width } = useWindowDimensions();

  const fields = result?.mrz?.fields || result?.doc?.fields || {};
  const confidence = result?.mrz?.confidence ?? result?.doc?.confidence ?? 0;
  const displayFields: { key: string; label: string; value: string }[] = [];
  if (docType === 'passport' && result?.mrz?.fields) {
    const f = result.mrz.fields as Record<string, string>;
    if (f.surname) displayFields.push({ key: 'surname', label: 'Soyad', value: f.surname });
    if (f.givenNames) displayFields.push({ key: 'givenNames', label: 'Ad', value: f.givenNames });
    if (f.documentNumber) displayFields.push({ key: 'documentNumber', label: 'Belge No', value: f.documentNumber });
    if (f.birthDate) displayFields.push({ key: 'birthDate', label: 'Doğum Tarihi', value: f.birthDate });
    if (f.expiryDate) displayFields.push({ key: 'expiryDate', label: 'Son Geçerlilik', value: f.expiryDate });
    if (f.nationality) displayFields.push({ key: 'nationality', label: 'Uyruk', value: f.nationality });
  } else if ((docType === 'tr_id' || docType === 'tr_dl') && result?.doc?.fields) {
    const f = result.doc.fields as Record<string, string | null | undefined>;
    if (f.ad) displayFields.push({ key: 'ad', label: 'Ad', value: String(f.ad) });
    if (f.soyad) displayFields.push({ key: 'soyad', label: 'Soyad', value: String(f.soyad) });
    if (f.tcKimlikNo) displayFields.push({ key: 'tcKimlikNo', label: 'TC Kimlik No', value: String(f.tcKimlikNo) });
    if (f.dogumTarihi) displayFields.push({ key: 'dogumTarihi', label: 'Doğum Tarihi', value: String(f.dogumTarihi) });
    if (f.belgeNo) displayFields.push({ key: 'belgeNo', label: 'Belge No', value: String(f.belgeNo) });
  }

  const getValue = (key: string, fallback: string) => edited[key] ?? fallback ?? '';

  const onConfirm = () => {
    scanLogger.scan_confirmed({ correlationId, docType });
    scanStore.setLastResult({
      docType,
      imageBase64,
      mrz: result?.mrz ? { ok: result.mrz.ok, confidence: result.mrz.confidence, fields: result.mrz.fields, checks: result.mrz.checks } : undefined,
      doc: result?.doc,
      correlationId,
    });
    navigation.getParent()?.navigate('CheckIn', { fromScan: true, scanResult: { docType, fields: { ...fields, ...edited } } });
  };

  const onRetake = () => {
    navigation.replace('ScanCamera', { docType });
  };

  const logs = getLastScanEvents(50);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {imageBase64 ? (
          <Image
            source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
            style={[styles.preview, { width: width - 32, height: Math.round((width - 32) * 0.6) }]}
            resizeMode="cover"
          />
        ) : null}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Okunan bilgiler (güven: %{confidence})</Text>
          {displayFields.map(({ key, label, value }) => (
            <View key={key} style={styles.row}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                value={getValue(key, value)}
                onChangeText={(t) => setEdited((e) => ({ ...e, [key]: t }))}
                placeholder={value || '-'}
              />
            </View>
          ))}
        </View>
        {correlationId ? (
          <TouchableOpacity onPress={() => setShowDebug(!showDebug)} style={styles.debugToggle}>
            <Text style={[styles.debugToggleText, { color: colors.textSecondary }]}>
              {showDebug ? 'Debug ▼' : 'Debug ▶'} correlationId: {correlationId.slice(0, 16)}…
            </Text>
          </TouchableOpacity>
        ) : null}
        {showDebug && (
          <View style={[styles.debugBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.debugTitle, { color: colors.text }]}>Son 50 log</Text>
            {logs.map((ev, i) => (
              <Text key={i} style={[styles.debugLine, { color: colors.textSecondary }]} numberOfLines={1}>
                {new Date(ev.at).toISOString().slice(11, 23)} {ev.name} {JSON.stringify(ev.meta).slice(0, 60)}…
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={onRetake} style={[styles.btnSecondary, { borderColor: colors.border }]}>
          <Ionicons name="camera-reverse-outline" size={20} color={colors.text} />
          <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Yeniden çek</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onConfirm} style={[styles.btnPrimary, { backgroundColor: colors.primary }]}>
          <Text style={styles.btnPrimaryText}>Onayla</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  preview: { borderRadius: 12, marginBottom: 16 },
  section: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  row: { marginBottom: 12 },
  label: { fontSize: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16 },
  debugToggle: { paddingVertical: 8 },
  debugToggleText: { fontSize: 12 },
  debugBox: { borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 },
  debugTitle: { fontWeight: '600', marginBottom: 8 },
  debugLine: { fontSize: 10, marginBottom: 2 },
  footer: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  btnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 8 },
  btnSecondaryText: { fontSize: 16 },
  btnPrimary: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
