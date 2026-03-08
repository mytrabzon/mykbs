import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const POLICY_TITLE = 'Privacy Policy';
const POLICY_SUBTITLE = 'LITXTECH LLC – MYKBS Application';
const POLICY_UPDATED = 'Last Updated: March 2026';

const SECTIONS = [
  { title: '1. Introduction', body: 'MYKBS is a hospitality compliance and identity verification application developed and operated by LITXTECH LLC.\n\nThe application is designed to help accommodation providers manage legally required guest identity registrations and transmit necessary information to official systems where required by law.\n\nLITXTECH LLC respects the privacy of users and is committed to protecting personal data in accordance with applicable laws and platform policies.\n\nThis Privacy Policy explains what information we collect, how it is used, and how it is protected.' },
  { title: '2. Information We Collect', body: 'MYKBS may process the following categories of information:\n\nIdentity Information\nWhen accommodation providers register guests as required by local regulations, the following information may be processed: Full name; National ID or passport number; Date of birth; Nationality; Passport or ID document data (including MRZ data when scanned).\n\nContact Information\nIf provided by the accommodation provider: Phone number; Email address.\n\nBusiness Information\nFor registered accommodation businesses: Business name; Branch information; KBS registration codes or facility identifiers.\n\nDevice Information\nTo ensure system security and stability, limited technical data may be collected: Device model; Operating system version; Application version; Error logs. This information is used solely for system reliability and security.' },
  { title: '3. How We Use the Information', body: 'Information collected through MYKBS is used for the following purposes: Recording guest identity information required by hospitality regulations; Submitting legally required notifications to official systems when applicable; Managing accommodation branch records; Ensuring system security and preventing misuse; Improving application stability and performance.\n\nLITXTECH LLC does not sell or rent personal data to third parties.' },
  { title: '4. Legal Basis for Processing', body: 'Personal data processed within MYKBS may be required to comply with local hospitality and identity reporting regulations applicable to accommodation providers. The application functions as a technical platform that enables businesses to fulfill their legal reporting obligations.' },
  { title: '5. Data Storage and Security', body: 'LITXTECH LLC implements industry-standard technical and organizational measures to protect data against unauthorized access, alteration, disclosure, or destruction. These measures include: Encrypted communication (HTTPS); Secure infrastructure; Access control systems; Logging and monitoring. Only authorized systems and services may access stored data.' },
  { title: '6. Data Sharing', body: 'Personal data may be shared only in the following situations: With official government systems when legally required by hospitality regulations; With service providers that support infrastructure, hosting, or security operations under strict confidentiality obligations. No personal data is shared for advertising or marketing purposes.' },
  { title: '7. Data Retention', body: 'Personal data is retained only for as long as necessary to fulfill legal obligations and operational requirements of the hospitality reporting system. Retention periods may vary depending on applicable legal requirements.' },
  { title: '8. User Rights', body: 'Depending on applicable laws, individuals may have the right to: Request access to their personal data; Request correction of inaccurate information; Request deletion where legally permitted; Request information about how their data is processed. Requests may be submitted using the contact information below.' },
  { title: '9. Children\'s Privacy', body: 'MYKBS is designed for use by registered accommodation businesses and authorized staff members. The application is not intended for use by children.' },
  { title: '10. Changes to This Policy', body: 'LITXTECH LLC may update this Privacy Policy from time to time to reflect operational or legal changes. Updated versions will be published within the application or associated websites.' },
  { title: '11. Contact Information', body: 'If you have any questions regarding this Privacy Policy, you may contact:\n\nLITXTECH LLC\nEmail: support@litxtech.com' },
];

const CONTACT_EMAIL = 'support@litxtech.com';

export default function PrivacyConsentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isAuthenticated, acceptPrivacy, acceptPrivacyLocally } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        await acceptPrivacy();
      } else {
        await acceptPrivacyLocally();
      }
      if (!isAuthenticated && navigation.isFocused?.()) navigation.replace('TermsConsent');
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Onay kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>{POLICY_TITLE}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{POLICY_SUBTITLE}</Text>
        <Text style={[styles.updated, { color: colors.textSecondary }]}>{POLICY_UPDATED}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.text }]}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAccepted((a) => !a)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, accepted && { backgroundColor: colors.primary }]}>
            {accepted && <Ionicons name="checkmark" size={18} color="#FFF" />}
          </View>
          <Text style={[styles.checkLabel, { color: colors.text }]}>
            Gizlilik politikasını okudum ve kabul ediyorum
          </Text>
        </TouchableOpacity>

        {error ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.acceptButton,
            { backgroundColor: accepted ? colors.primary : colors.border },
          ]}
          onPress={handleAccept}
          disabled={!accepted || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Kabul ediyorum ve devam et</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={openEmail} style={styles.contactLink}>
          <Ionicons name="mail-outline" size={16} color={colors.primary} />
          <Text style={[styles.contactText, { color: colors.primary }]}>{CONTACT_EMAIL}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  updated: {
    fontSize: 12,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 14,
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
  },
  acceptButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  contactLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  contactText: {
    fontSize: 14,
  },
});
