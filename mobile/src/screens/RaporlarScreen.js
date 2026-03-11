import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api, getBackendUrl } from '../services/api';
import AppHeader from '../components/AppHeader';
import EmptyState from '../components/EmptyState';
import Toast from 'react-native-toast-message';

function formatDateForApi(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const defaultMaliyeFrom = () => {
  const d = new Date();
  d.setDate(1);
  return formatDateForApi(d);
};
const defaultMaliyeTo = () => formatDateForApi(new Date());

export default function RaporlarScreen({ navigation }) {
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [maliyeFrom, setMaliyeFrom] = useState(defaultMaliyeFrom());
  const [maliyeTo, setMaliyeTo] = useState(defaultMaliyeTo());
  const [maliyeLoading, setMaliyeLoading] = useState(null);

  const loadRapor = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await api.get('/rapor');
      setData(res?.data ?? null);
    } catch (err) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const msg = err?.response?.data?.message || err?.message || 'Rapor alınamadı';
      setError(msg);
      setData(null);
      if (!isRefresh) {
        if (status === 409) Toast.show({ type: 'info', text1: 'Onay Bekleniyor', text2: msg || 'Şube/KBS onayından sonra raporlar açılacaktır.', visibilityTime: 4000 });
        else if (status === 403) Toast.show({ type: 'error', text1: 'Yetki yok', text2: msg });
        else Toast.show({ type: 'error', text1: status === 500 ? 'Sunucu hatası' : 'Rapor yüklenemedi', text2: msg });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRapor();
  }, [loadRapor]);

  const handleMaliyePdf = useCallback(async () => {
    setMaliyeLoading('pdf');
    try {
      const res = await api.get(
        `/rapor/maliye/html?from=${encodeURIComponent(maliyeFrom)}&to=${encodeURIComponent(maliyeTo)}`,
        { responseType: 'text' }
      );
      const html = typeof res?.data === 'string' ? res.data : (res?.data && JSON.stringify(res.data));
      if (!html || html.length < 100) {
        Toast.show({ type: 'error', text1: 'Rapor alınamadı', text2: 'HTML yanıtı boş veya geçersiz.' });
        return;
      }
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Maliye Raporu (PDF)' });
      } else {
        Toast.show({ type: 'info', text1: 'PDF hazır', text2: 'Dosya: ' + uri });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'PDF oluşturulamadı', text2: e?.message || 'Beklenmeyen hata' });
    } finally {
      setMaliyeLoading(null);
    }
  }, [maliyeFrom, maliyeTo]);

  const handleMaliyeExcel = useCallback(async () => {
    setMaliyeLoading('excel');
    try {
      const res = await api.get(
        `/rapor/maliye/export?format=xlsx&from=${encodeURIComponent(maliyeFrom)}&to=${encodeURIComponent(maliyeTo)}`,
        { responseType: 'arraybuffer' }
      );
      const buf = res?.data;
      if (!buf) {
        Toast.show({ type: 'error', text1: 'Excel alınamadı', text2: 'Yanıt boş.' });
        return;
      }
      const filename = `Maliye_Raporu_${maliyeFrom.replace(/-/g, '')}.xlsx`;
      const uri = `${FileSystem.cacheDirectory}${filename}`;
      let base64;
      if (typeof buf === 'string') {
        base64 = buf;
      } else {
        const ab = buf instanceof ArrayBuffer ? buf : (buf.buffer || buf);
        const u8 = new Uint8Array(ab);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < u8.length; i += chunk) {
          binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
        }
        base64 = typeof btoa !== 'undefined' ? btoa(binary) : (global.Buffer ? Buffer.from(binary, 'binary').toString('base64') : null);
        if (!base64) {
          Toast.show({ type: 'error', text1: 'Excel kaydedilemedi', text2: 'Base64 dönüşümü desteklenmiyor.' });
          return;
        }
      }
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Maliye Raporu (Excel)' });
      } else {
        Toast.show({ type: 'info', text1: 'Excel hazır', text2: uri });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Excel indirilemedi', text2: e?.message || 'Beklenmeyen hata' });
    } finally {
      setMaliyeLoading(null);
    }
  }, [maliyeFrom, maliyeTo]);

  const handleMaliyePrint = useCallback(async () => {
    setMaliyeLoading('print');
    try {
      const res = await api.get(
        `/rapor/maliye/html?from=${encodeURIComponent(maliyeFrom)}&to=${encodeURIComponent(maliyeTo)}`,
        { responseType: 'text' }
      );
      const html = typeof res?.data === 'string' ? res.data : (res?.data && JSON.stringify(res.data));
      if (!html || html.length < 100) {
        Toast.show({ type: 'error', text1: 'Rapor alınamadı', text2: 'HTML yanıtı boş.' });
        return;
      }
      await Print.printAsync({ html });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Yazdırılamadı', text2: e?.message || 'Beklenmeyen hata' });
    } finally {
      setMaliyeLoading(null);
    }
  }, [maliyeFrom, maliyeTo]);

  const cards = data
    ? [
        {
          key: 'doluluk',
          icon: 'calendar',
          iconBg: colors.primarySoft,
          iconColor: colors.primary,
          label: 'Doluluk Oranı',
          value: `${data.dolulukOrani ?? 0}%`,
        },
        {
          key: 'aktif',
          icon: 'person',
          iconBg: colors.successSoft,
          iconColor: colors.success,
          label: 'Aktif Misafir',
          value: String(data.aktifMisafirSayisi ?? 0),
        },
        {
          key: 'yeni',
          icon: 'person-add',
          iconBg: colors.warningSoft,
          iconColor: colors.warning,
          label: 'Bu Ay Yeni Giriş',
          value: String(data.buAyYeniMisafir ?? 0),
        },
        {
          key: 'kalış',
          icon: 'time',
          iconBg: colors.accentSoft || colors.primarySoft,
          iconColor: colors.accent || colors.primary,
          label: 'Ort. Kalış',
          value:
            data.ortalamaKalısGun != null ? `${data.ortalamaKalısGun} gün` : '—',
        },
      ]
    : [];

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Raporlar"
        tesis={tesis}
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('DahaFazla', { screen: 'Ayarlar' })}
      />
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Rapor yükleniyor...
          </Text>
        </View>
      ) : error && !data ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRapor(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <EmptyState
            icon="stats-chart-outline"
            title="Rapor alınamadı"
            message={error}
            primaryCta={{ label: 'Tekrar dene', onPress: () => loadRapor(true) }}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRapor(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.reportsGrid}>
            {cards.map((r) => (
              <View
                key={r.key}
                style={[styles.reportCardModern, { backgroundColor: colors.surface }]}
              >
                <View style={[styles.reportIconModern, { backgroundColor: r.iconBg }]}>
                  <Ionicons name={r.icon} size={24} color={r.iconColor} />
                </View>
                <Text style={[styles.reportValueModern, { color: colors.textPrimary }]}>
                  {r.value}
                </Text>
                <Text style={[styles.reportTitleModern, { color: colors.textSecondary }]}>
                  {r.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.chartContainerModern, { backgroundColor: colors.surface }]}>
            <Text style={[styles.chartTitleModern, { color: colors.textPrimary }]}>
              Özet
            </Text>
            <View style={[styles.chartPlaceholderModern, { backgroundColor: colors.background }]}>
              <Text style={[styles.chartPlaceholderText, { color: colors.textSecondary }]}>
                {data
                  ? `${data.doluOda ?? 0} dolu / ${data.toplamOda ?? 0} oda · Doluluk %${data.dolulukOrani ?? 0}`
                  : 'Veri yok'}
              </Text>
              <Text style={[styles.chartPlaceholderSub, { color: colors.textSecondary }]}>
                Günlük doluluk grafiği ileride eklenecektir.
              </Text>
            </View>
          </View>

          <View style={[styles.maliyeSection, { backgroundColor: colors.surface }]}>
            <Text style={[styles.chartTitleModern, { color: colors.textPrimary }]}>
              Maliye Bakanlığı Raporları
            </Text>
            <Text style={[styles.maliyeSub, { color: colors.textSecondary }]}>
              Giriş-çıkış defteri, doluluk, KBS bildirim özeti ve vergi raporu
            </Text>
            <View style={styles.maliyeRow}>
              <Text style={[styles.maliyeLabel, { color: colors.textSecondary }]}>Başlangıç (YYYY-AA-GG)</Text>
              <TextInput
                style={[styles.maliyeInput, { color: colors.textPrimary, borderColor: colors.border || '#e2e8f0' }]}
                value={maliyeFrom}
                onChangeText={setMaliyeFrom}
                placeholder="2026-03-01"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.maliyeRow}>
              <Text style={[styles.maliyeLabel, { color: colors.textSecondary }]}>Bitiş (YYYY-AA-GG)</Text>
              <TextInput
                style={[styles.maliyeInput, { color: colors.textPrimary, borderColor: colors.border || '#e2e8f0' }]}
                value={maliyeTo}
                onChangeText={setMaliyeTo}
                placeholder="2026-03-11"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.maliyeButtons}>
              <TouchableOpacity
                style={[styles.maliyeBtn, { backgroundColor: colors.primary }]}
                onPress={handleMaliyePdf}
                disabled={!!maliyeLoading}
              >
                {maliyeLoading === 'pdf' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="document-text-outline" size={20} color="#fff" />}
                <Text style={styles.maliyeBtnText}>PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.maliyeBtn, { backgroundColor: colors.success || '#22c55e' }]}
                onPress={handleMaliyeExcel}
                disabled={!!maliyeLoading}
              >
                {maliyeLoading === 'excel' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="grid-outline" size={20} color="#fff" />}
                <Text style={styles.maliyeBtnText}>Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.maliyeBtn, { backgroundColor: colors.textSecondary || '#64748b' }]}
                onPress={handleMaliyePrint}
                disabled={!!maliyeLoading}
              >
                {maliyeLoading === 'print' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="print-outline" size={20} color="#fff" />}
                <Text style={styles.maliyeBtnText}>Yazdır</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  emptyContainer: { flex: 1, paddingHorizontal: 20, paddingBottom: 120 },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    marginBottom: 20,
    gap: 12,
  },
  reportCardModern: {
    width: '48%',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  reportIconModern: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitleModern: { fontSize: 13, marginTop: 4 },
  reportValueModern: { fontSize: 24, fontWeight: '700' },
  chartContainerModern: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  chartTitleModern: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  chartPlaceholderModern: {
    minHeight: 120,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  chartPlaceholderText: { fontSize: 15, fontWeight: '500' },
  chartPlaceholderSub: { fontSize: 12, marginTop: 8 },
  maliyeSection: {
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  maliyeSub: { fontSize: 12, marginBottom: 16 },
  maliyeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  maliyeLabel: { fontSize: 13, flex: 1 },
  maliyeInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, minWidth: 120 },
  maliyeDate: { fontSize: 14, fontWeight: '600' },
  maliyeButtons: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  maliyeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 90,
    justifyContent: 'center',
  },
  maliyeBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
