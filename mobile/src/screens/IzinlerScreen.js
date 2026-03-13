/**
 * İzinler ekranı: Kullanıcı hangi izinleri verdi / vermedi görür,
 * izin isteyebilir veya uygulama ayarlarına giderek izinleri kaldırabilir.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import AppHeader from '../components/AppHeader';
import {
  getAppPermissionsAsync,
  requestCameraPermissionAsync,
  requestMediaLibraryPermissionAsync,
  requestNotificationPermissionAsync,
  openAppSettingsAsync,
} from '../services/appPermissions';
import Toast from 'react-native-toast-message';
import { spacing, typography } from '../theme';

const LABELS = {
  camera: { title: 'Kamera', desc: 'Kimlik ve pasaport okuma, QR tarama', icon: 'camera-outline' },
  mediaLibrary: { title: 'Galeri / Fotoğraflar', desc: 'Profil fotoğrafı ve belge seçimi', icon: 'images-outline' },
  notifications: { title: 'Bildirimler', desc: 'Push bildirimleri almak için', icon: 'notifications-outline' },
};

function statusLabel(status) {
  if (status === 'granted') return { text: 'Verildi', colorKey: 'success' };
  if (status === 'denied') return { text: 'Reddedildi', colorKey: 'error' };
  return { text: 'Sorulmadı', colorKey: 'textSecondary' };
}

export default function IzinlerScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [perms, setPerms] = useState({ camera: null, mediaLibrary: null, notifications: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(null);

  const load = useCallback(async () => {
    const p = await getAppPermissionsAsync();
    setPerms(p);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [load]);

  const handleRequest = useCallback(async (key) => {
    if (requesting) return;
    setRequesting(key);
    try {
      let status;
      if (key === 'camera') status = await requestCameraPermissionAsync();
      else if (key === 'mediaLibrary') status = await requestMediaLibraryPermissionAsync();
      else if (key === 'notifications') status = await requestNotificationPermissionAsync();
      else return;
      setPerms((prev) => ({ ...prev, [key]: status }));
      if (status === 'granted') {
        Toast.show({ type: 'success', text1: 'İzin verildi', text2: `${LABELS[key].title} izni açıldı.` });
      } else if (status === 'denied') {
        Toast.show({
          type: 'info',
          text1: 'İzin reddedildi',
          text2: 'İsterseniz tekrar "İzin ver" ile deneyebilirsiniz.',
        });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hata', text2: e?.message || 'İzin alınamadı' });
    } finally {
      setRequesting(null);
    }
  }, [requesting]);

  const handleOpenSettings = useCallback(async () => {
    try {
      await openAppSettingsAsync();
      Toast.show({
        type: 'info',
        text1: 'Ayarlar açıldı',
        text2: 'İzinleri buradan açıp kapatabilirsiniz.',
      });
    } catch (e) {
      Linking.openSettings().catch(() => {});
    }
  }, []);

  if (loading && !perms.camera && !perms.mediaLibrary && !perms.notifications) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader
          title="İzinler"
          onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
          onNotification={() => navigation.navigate('Bildirimler')}
        />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="İzinler"
        onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main'))}
        onNotification={() => navigation.navigate('Bildirimler')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[colors.primary]} />}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Tüm izinler uygulama içinde "İzin ver" ile verilir. Hangi izinlerin açık olduğunu aşağıda görebilirsiniz.
        </Text>

        {(['camera', 'mediaLibrary', 'notifications']).map((key) => {
          const status = perms[key] || 'undetermined';
          const { text: statusText, colorKey } = statusLabel(status);
          const label = LABELS[key];
          const isRequesting = requesting === key;
          const canRequest = status !== 'granted';
          return (
            <View
              key={key}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name={label.icon} size={24} color={colors.primary} />
                </View>
                <View style={styles.cardTitleWrap}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{label.title}</Text>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>{label.desc}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: colors[colorKey] ? `${colors[colorKey]}22` : colors.background }]}>
                  <Text style={[styles.badgeText, { color: colors[colorKey] || colors.textPrimary }]}>{statusText}</Text>
                </View>
              </View>
              {canRequest && (
                <TouchableOpacity
                  style={[styles.requestBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleRequest(key)}
                  disabled={isRequesting}
                >
                  {isRequesting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.requestBtnText}>İzin ver</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>İzinleri kaldırmak için</Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Verdiğiniz bir izni kapatmak isterseniz cihaz ayarlarından uygulamayı açıp ilgili izni kapatabilirsiniz. Yeni izin vermek için yukarıdaki "İzin ver" butonunu kullanın.
          </Text>
          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={handleOpenSettings}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
            <Text style={[styles.settingsBtnText, { color: colors.primary }]}>Cihaz ayarlarını aç</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: spacing.screenPadding, paddingBottom: 80 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.text.body.fontSize },
  intro: {
    fontSize: typography.text.body.fontSize,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardTitleWrap: { flex: 1 },
  cardTitle: {
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: '600',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  requestBtn: {
    paddingVertical: spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  requestBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.text.bodyLarge.fontSize,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    fontSize: typography.text.body.fontSize,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingsBtnText: { fontWeight: '600', fontSize: 15 },
});
