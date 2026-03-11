/**
 * Destek talebi — hamburger menüden açılır; konu + mesaj ile talebi backend'e gönderir.
 * Admin panelde destek talepleri listesinde anında görünür.
 */
import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

export default function DestekScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

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
        >
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor }]}>
            <View style={[styles.iconWrap, { backgroundColor: (colors.primary || '#06B6D4') + '18' }]}>
              <Ionicons name="help-buoy" size={40} color={colors.primary || '#06B6D4'} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Destek talebi gönderin</Text>
            <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
              Sorunuzu veya talebinizi yazın; ekip en kısa sürede yanıtlayacaktır.
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
});
