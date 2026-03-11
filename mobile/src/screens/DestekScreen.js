/**
 * Destek talebi — hamburger menüden açılır; konu + mesaj ile talebi backend'e gönderir.
 * Admin: Açılan talepler bu ekranda ve web panelde Destek sayfasında görünür.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getBackendUrl } from '../services/apiSupabase';
import { getEffectiveRole } from '../utils/adminAuth';
import Toast from 'react-native-toast-message';

function statusLabel(status) {
  if (status === 'acik') return 'Açık';
  if (status === 'isleme_alindi') return 'İşleme alındı';
  if (status === 'cevaplandi') return 'Cevaplandı';
  if (status === 'kapatildi') return 'Kapatıldı';
  return status || '—';
}

function TicketCard({ item, colors, showAdminNote = false }) {
  const dateStr = item.createdAt
    ? new Date(item.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
  return (
    <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.ticketHeader}>
        <Text style={[styles.ticketId, { color: colors.textSecondary }]}>#{String(item.id).slice(-8)}</Text>
        <Text style={[styles.ticketStatus, { color: colors.primary }]}>{statusLabel(item.status)}</Text>
        <Text style={[styles.ticketDate, { color: colors.textSecondary }]}>{dateStr}</Text>
      </View>
      <Text style={[styles.ticketSubject, { color: colors.textPrimary }]} numberOfLines={1}>{item.subject}</Text>
      {(item.tesisAdi || item.authorName) && (
        <Text style={[styles.ticketMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {[item.tesisAdi, item.authorName].filter(Boolean).join(' · ')}
        </Text>
      )}
      <Text style={[styles.ticketMessage, { color: colors.textSecondary }]} numberOfLines={2}>{item.message}</Text>
      {showAdminNote && item.adminNote ? (
        <View style={[styles.adminNoteWrap, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}>
          <Text style={[styles.adminNoteLabel, { color: colors.primary }]}>Destek notu:</Text>
          <Text style={[styles.adminNoteText, { color: colors.textPrimary }]}>{item.adminNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DestekScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tesis, token, user } = useAuth();
  const isAdmin = ['admin', 'super_admin'].includes(getEffectiveRole(user));
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsRefreshing, setTicketsRefreshing] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [myTicketsLoading, setMyTicketsLoading] = useState(false);
  const [myTicketsRefreshing, setMyTicketsRefreshing] = useState(false);

  const fetchTickets = useCallback(async (isRefresh = false) => {
    if (!isAdmin) return;
    if (isRefresh) setTicketsRefreshing(true);
    else setTicketsLoading(true);
    const base = getBackendUrl();
    if (!base || !token) {
      setTicketsLoading(false);
      setTicketsRefreshing(false);
      return;
    }
    try {
      const r = await fetch(`${base}/api/app-admin/support`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) setTickets(json.tickets || []);
    } catch (_) {
      setTickets([]);
    }
    setTicketsLoading(false);
    setTicketsRefreshing(false);
  }, [isAdmin, token]);

  const fetchMyTickets = useCallback(async (isRefresh = false) => {
    if (isAdmin) return;
    if (isRefresh) setMyTicketsRefreshing(true);
    else setMyTicketsLoading(true);
    try {
      const res = await api.get('/support');
      setMyTickets(res?.data?.tickets ?? []);
    } catch (_) {
      setMyTickets([]);
    }
    setMyTicketsLoading(false);
    setMyTicketsRefreshing(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchTickets();
    else fetchMyTickets();
  }, [isAdmin, fetchTickets, fetchMyTickets]);

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  const handleSubmit = async () => {
    const konu = (subject || '').trim();
    const mesaj = (message || '').trim();
    if (!konu) {
      Toast.show({ type: 'info', text1: 'Konu gerekli', text2: 'Lütfen bir konu yazın.' });
      return;
    }
    if (!mesaj) {
      Toast.show({ type: 'info', text1: 'Mesaj gerekli', text2: 'Lütfen mesajınızı yazın.' });
      return;
    }
    setSending(true);
    try {
      await api.post('/support', { subject: konu, message: mesaj });
      Toast.show({
        type: 'success',
        text1: 'Talep gönderildi',
        text2: 'Destek ekibimiz en kısa sürede size dönüş yapacaktır.',
      });
      setSubject('');
      setMessage('');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Talep gönderilemedi.';
      Toast.show({ type: 'error', text1: 'Gönderilemedi', text2: msg });
    } finally {
      setSending(false);
    }
  };

  const inputBg = colors.surface || '#fff';
  const borderColor = colors.border || '#e2e8f0';
  const placeholderColor = colors.textSecondary || '#64748b';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Destek</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            isAdmin
              ? <RefreshControl refreshing={ticketsRefreshing} onRefresh={() => fetchTickets(true)} colors={[colors.primary]} />
              : <RefreshControl refreshing={myTicketsRefreshing} onRefresh={() => fetchMyTickets(true)} colors={[colors.primary]} />
          }
        >
          {isAdmin && (
            <View style={styles.ticketsSection}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Açılan talepler</Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                Talepleri işlemek için web paneli kullanın: Giriş yap → Sol menü → Destek → Talebe tıklayın (durum, admin notu, bildirim).
              </Text>
              {ticketsLoading && tickets.length === 0 ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.ticketsLoader} />
              ) : tickets.length === 0 ? (
                <Text style={[styles.ticketsEmpty, { color: colors.textSecondary }]}>Henüz talep yok</Text>
              ) : (
                tickets.slice(0, 20).map((t) => <TicketCard key={t.id} item={t} colors={colors} />)
              )}
            </View>
          )}

          {!isAdmin && (
            <>
              <View style={styles.ticketsSection}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Taleplerim</Text>
                {myTicketsLoading && myTickets.length === 0 ? (
                  <ActivityIndicator size="small" color={colors.primary} style={styles.ticketsLoader} />
                ) : myTickets.length === 0 ? (
                  <Text style={[styles.ticketsEmpty, { color: colors.textSecondary }]}>Henüz talep göndermediniz.</Text>
                ) : (
                  myTickets.map((t) => <TicketCard key={t.id} item={t} colors={colors} showAdminNote />)
                )}
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor }]}>
                <View style={[styles.iconWrap, { backgroundColor: (colors.primary || '#06B6D4') + '18' }]}>
                  <Ionicons name="help-buoy" size={40} color={colors.primary || '#06B6D4'} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Yeni destek talebi</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  Sorunuzu veya talebinizi yazın; ekip en kısa sürede yanıtlayacaktır. Çözüm veya not eklendiğinde bildirim alırsınız.
                </Text>

                <Text style={[styles.label, { color: colors.textSecondary }]}>Konu</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor, color: colors.textPrimary }]}
                  placeholder="Örn: KBS bağlantı hatası"
                  placeholderTextColor={placeholderColor}
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={500}
                  editable={!sending}
                />

                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Mesajınız</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: inputBg, borderColor, color: colors.textPrimary }]}
                  placeholder="Sorununuzu veya talebinizi detaylı yazın..."
                  placeholderTextColor={placeholderColor}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={5}
                  maxLength={10000}
                  textAlignVertical="top"
                  editable={!sending}
                />

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary || '#06B6D4' }]}
                  onPress={handleSubmit}
                  disabled={sending}
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={20} color="#fff" />
                      <Text style={styles.submitText}>Gönder</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {tesis?.tesisAdi && (
                <Text style={[styles.footerHint, { color: colors.textSecondary }]}>
                  Talep tesisiniz ({tesis.tesisAdi}) ile ilişkilendirilecektir.
                </Text>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 24 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  cardTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  cardSub: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  textArea: { minHeight: 120, paddingTop: 14 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  footerHint: { fontSize: 12, textAlign: 'center', marginTop: 16 },
  ticketsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  sectionSub: { fontSize: 13, marginBottom: 12 },
  ticketsLoader: { marginVertical: 16 },
  ticketsEmpty: { fontSize: 14, marginVertical: 12 },
  ticketCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ticketId: { fontSize: 12, marginRight: 8 },
  ticketStatus: { fontSize: 12, fontWeight: '600', marginRight: 8 },
  ticketDate: { fontSize: 11, flex: 1, textAlign: 'right' },
  ticketSubject: { fontSize: 15, fontWeight: '600' },
  ticketMeta: { fontSize: 12, marginTop: 4 },
  ticketMessage: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  adminNoteWrap: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  adminNoteLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  adminNoteText: { fontSize: 14, lineHeight: 20 },
});
