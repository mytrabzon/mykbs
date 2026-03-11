/**
 * Web'de olup mobilde henüz tam uygulanmayan sekmeler için placeholder.
 * İsteğe bağlı web URL'ine yönlendirme.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { ENV } from '../lib/config/env';

export default function PlaceholderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const title = route?.params?.title || 'Sayfa';
  const webPath = route?.params?.webPath || '';
  const adminUrl = (ENV.ADMIN_PANEL_WEB_URL || '').trim() || 'http://localhost:3000';
  const fullUrl = webPath ? `${adminUrl.replace(/\/$/, '')}/${webPath.replace(/^\//, '')}` : adminUrl;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <View style={styles.backBtn} />
      </View>
      <View style={styles.content}>
        <Ionicons name="construct-outline" size={64} color={colors.textSecondary} style={styles.icon} />
        <Text style={[styles.message, { color: colors.textPrimary }]}>Bu bölüm mobilde yakında eklenecek.</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Web panelinden erişebilirsiniz.</Text>
        <TouchableOpacity
          style={[styles.webBtn, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(fullUrl)}
          activeOpacity={0.8}
        >
          <Ionicons name="open-outline" size={20} color="#fff" />
          <Text style={styles.webBtnText}>Web panelini aç</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  icon: { marginBottom: 20 },
  message: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  webBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  webBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
