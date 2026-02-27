import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getBackendUrl } from '../services/api';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../components/AppHeader';
import { typography, spacing } from '../theme';

export default function AddRoomScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const [loading, setLoading] = useState(false);
  const [odaNumarasi, setOdaNumarasi] = useState('');
  const [odaTipi, setOdaTipi] = useState('Standart Oda');
  const [kapasite, setKapasite] = useState('2');
  const [not, setNot] = useState('');

  const hasBackend = !!getBackendUrl();

  const handleSave = async () => {
    const num = odaNumarasi.trim();
    const kap = parseInt(kapasite, 10);
    if (!num) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Oda numarası gerekli' });
      return;
    }
    if (isNaN(kap) || kap < 1 || kap > 20) {
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Kapasite 1–20 arası olmalı' });
      return;
    }
    if (!hasBackend) {
      Toast.show({ type: 'error', text1: 'Sunucu yok', text2: 'Oda eklemek için backend bağlantısı gerekli' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/oda', {
        odaNumarasi: num,
        odaTipi: odaTipi.trim() || 'Standart Oda',
        kapasite: kap,
        not: not.trim() || undefined,
      });
      Toast.show({ type: 'success', text1: 'Oda eklendi' });
      if (route.params?.onAdded) route.params.onAdded();
      navigation.goBack();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Oda eklenemedi';
      Toast.show({ type: 'error', text1: 'Hata', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Yeni Oda Ekle"
        tesis={tesis}
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Oda numarası *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={odaNumarasi}
              onChangeText={setOdaNumarasi}
              placeholder="Örn. 101"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Oda tipi</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={odaTipi}
              onChangeText={setOdaTipi}
              placeholder="Standart Oda, Suite, vb."
              placeholderTextColor={colors.textSecondary}
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Kapasite (kişi) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={kapasite}
              onChangeText={setKapasite}
              placeholder="2"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Not</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
              value={not}
              onChangeText={setNot}
              placeholder="İsteğe bağlı"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={2}
            />
          </View>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={22} color="#fff" />
                <Text style={styles.btnText}>Oda Ekle</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.screenPadding, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: spacing.cardPadding,
    marginBottom: 24,
  },
  label: { fontSize: typography.text.caption.fontSize, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: typography.text.body.fontSize,
    marginBottom: 16,
  },
  inputMultiline: { minHeight: 72 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
