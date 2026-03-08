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

const TITLE = 'Terms of Service';
const SUBTITLE = 'MYKBS Application – Operated by LITXTECH LLC';
const UPDATED = 'Last Updated: March 2026';

const SECTIONS = [
  { title: '1. Acceptance of Terms', body: 'These Terms of Service govern the use of the MYKBS application, operated by LITXTECH LLC.\n\nBy accessing or using the MYKBS application, you agree to comply with these Terms.\n\nIf you do not agree with these Terms, you must not use the application.' },
  { title: '2. Description of the Service', body: 'MYKBS is a hospitality compliance and identity verification platform designed to assist accommodation providers in managing guest identity records and transmitting legally required information to official reporting systems where applicable.\n\nThe application provides tools for: Guest identity registration; Passport or ID scanning; Branch management for accommodation businesses; Transmission of legally required reporting data.\n\nMYKBS functions as a technical platform that helps accommodation providers manage compliance processes.' },
  { title: '3. Eligible Users', body: 'The MYKBS application is intended for use by: Licensed accommodation providers; Authorized hotel or lodging staff; Businesses required to comply with guest identity reporting regulations.\n\nUsers must have the legal authority to process and submit guest information within their organization.' },
  { title: '4. User Responsibilities', body: 'Users agree that they will: Use the application only for lawful purposes; Enter accurate and legitimate guest information; Comply with all applicable hospitality and identity reporting regulations; Protect access credentials and prevent unauthorized access.\n\nUsers are responsible for ensuring that guest information entered into the system is accurate and lawfully collected.' },
  { title: '5. Legal Compliance', body: 'MYKBS is designed to support accommodation providers in fulfilling legal reporting obligations. However, LITXTECH LLC is not responsible for ensuring that a business complies with local laws or regulations. Each accommodation provider is responsible for complying with all applicable legal requirements.' },
  { title: '6. Data Processing', body: 'The application may process personal data including guest identity information as part of legally required reporting processes. Data processing is conducted in accordance with the MYKBS Privacy Policy. Users agree that they have the legal authority to process and submit guest information through the application.' },
  { title: '7. Service Availability', body: 'LITXTECH LLC strives to maintain reliable system availability but does not guarantee uninterrupted access to the MYKBS service. Temporary interruptions may occur due to: System maintenance; Infrastructure issues; Third-party service outages; Network conditions.' },
  { title: '8. Limitation of Liability', body: 'To the maximum extent permitted by law, LITXTECH LLC shall not be liable for: Incorrect information submitted by users; Legal penalties incurred due to misuse of the system; Loss of data caused by user error; Service interruptions beyond reasonable control. Users are responsible for verifying information before submission.' },
  { title: '9. Account Security', body: 'Users are responsible for maintaining the confidentiality of their account credentials. Any activity conducted through a user account is the responsibility of the account holder. Users must immediately notify LITXTECH LLC if unauthorized access is suspected.' },
  { title: '10. Intellectual Property', body: 'All software, design, systems, and technology related to the MYKBS application are the intellectual property of LITXTECH LLC. Users may not: Reverse engineer the application; Copy or redistribute the software; Attempt to bypass security mechanisms.' },
  { title: '11. Termination', body: 'LITXTECH LLC reserves the right to suspend or terminate accounts that: Violate these Terms; Attempt to misuse the platform; Engage in unlawful activities. Users may discontinue use of the application at any time.' },
  { title: '12. Modifications to the Terms', body: 'LITXTECH LLC may update these Terms from time to time. Updated versions will be published within the application or official service channels. Continued use of the application after updates constitutes acceptance of the revised Terms.' },
  { title: '13. Governing Law', body: 'These Terms shall be governed by and interpreted in accordance with the applicable laws governing the operations of LITXTECH LLC.' },
  { title: '14. Contact', body: 'For questions regarding these Terms of Service:\n\nLITXTECH LLC\nEmail: support@litxtech.com' },
];

const CONTACT_EMAIL = 'support@litxtech.com';

export default function TermsConsentScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isAuthenticated, acceptTerms, acceptTermsLocally } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    if (!accepted) return;
    setLoading(true);
    setError(null);
    try {
      if (isAuthenticated) {
        await acceptTerms();
      } else {
        await acceptTermsLocally();
      }
      if (!isAuthenticated && navigation.isFocused?.()) navigation.replace('Login');
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
        <Text style={[styles.title, { color: colors.text }]}>{TITLE}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{SUBTITLE}</Text>
        <Text style={[styles.updated, { color: colors.textSecondary }]}>{UPDATED}</Text>
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
            Kullanım şartlarını okudum ve kabul ediyorum
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
