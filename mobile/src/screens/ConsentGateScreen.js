/**
 * Uygulama açıldığında (iOS ve Android) gizlilik ve kullanım şartları onayı.
 * Giriş yapmadan okuyup onaylayabilir; onay cihazda saklanır, giriş sonrası gerekiyorsa backend'e de iletilir.
 * İki metin tıklanınca modal ile açılır, kapatılır; "Onayla" ile her ikisi kabul edilir, bir daha gösterilmez.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../constants/consentContent';

const MODAL_TITLES = {
  privacy: 'Gizlilik Politikası',
  terms: 'Kullanım Şartları',
};

export default function ConsentGateScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const {
    isAuthenticated,
    acceptPrivacy,
    acceptTerms,
    acceptPrivacyLocally,
    acceptTermsLocally,
  } = useAuth();
  const [modalType, setModalType] = useState(null); // 'privacy' | 'terms' | null
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sections = modalType === 'privacy' ? PRIVACY_SECTIONS : modalType === 'terms' ? TERMS_SECTIONS : [];

  const handleOnayla = async () => {
    if (!accepted) return;
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        await acceptPrivacy();
        await acceptTerms();
      } else {
        await acceptPrivacyLocally();
        await acceptTermsLocally();
      }
      if (!navigation.isFocused?.()) return;
      try {
        if (isAuthenticated) {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          navigation.replace('Login');
        }
      } catch (navErr) {
        setTimeout(() => {
          if (navigation.isFocused?.()) {
            try {
              if (isAuthenticated) navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
              else navigation.replace('Login');
            } catch (_) {}
          }
        }, 100);
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Onay kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={[styles.header, { paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Gizlilik ve Kullanım Şartları</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Giriş yapmadan aşağıdaki metinleri okuyup onaylayabilirsiniz. Onay cihazınızda kaydedilir; onayladıktan sonra giriş ekranına geçersiniz.
        </Text>
      </View>

      <View style={[styles.cardList, { paddingHorizontal: 24 }]}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setModalType('privacy')}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="shield-checkmark-outline" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Gizlilik Politikası</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setModalType('terms')}
          activeOpacity={0.7}
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Kullanım Şartları</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border, paddingHorizontal: 24 }]}>
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAccepted((a) => !a)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, accepted && { backgroundColor: colors.primary }]}>
            {accepted && <Ionicons name="checkmark" size={18} color="#FFF" />}
          </View>
          <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>
            Her iki metni okudum ve kabul ediyorum
          </Text>
        </TouchableOpacity>

        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        ) : null}

        {!isAuthenticated ? (
          <Text style={[styles.footerHint, { color: colors.textSecondary }]}>
            Onayladıktan sonra giriş ekranına yönlendirileceksiniz.
          </Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.onaylaButton,
            { backgroundColor: accepted ? colors.primary : colors.border },
          ]}
          onPress={handleOnayla}
          disabled={!accepted || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.onaylaButtonText}>
              {isAuthenticated ? 'Onayla' : 'Onayla ve devam et'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={!!modalType}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalType(null)}
      >
        <View style={[styles.modalWrap, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {modalType ? MODAL_TITLES[modalType] : ''}
            </Text>
            <TouchableOpacity
              onPress={() => setModalType(null)}
              style={[styles.modalCloseBtn, { backgroundColor: colors.surface }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={true}
          >
            {sections.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>{section.title}</Text>
                <Text style={[styles.sectionBody, { color: colors.textPrimary }]}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
  },
  cardList: {
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkLabel: {
    fontSize: 15,
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 12,
  },
  footerHint: {
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  onaylaButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onaylaButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  modalWrap: {
    flex: 1,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
  },
});
