import 'react-native-gesture-handler';
import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { getApiBaseUrl } from './src/config/api';
import { dataService } from './src/services/dataService';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ErrorBoundary from './src/components/ErrorBoundary';
import EmptyState from './src/components/EmptyState';
import AppHeader from './src/components/AppHeader';
import { logger } from './src/utils/logger';
import { getIsAdminPanelUser } from './src/utils/adminAuth';
import { backendHealth } from './src/services/backendHealth';
import { registerPushToken } from './src/services/pushNotifications';
import { BackHandler, Alert, Platform, View, Text, StyleSheet, TouchableOpacity, Linking, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { supabase } from './src/lib/supabase/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import OTPVerifyScreen from './src/screens/OTPVerifyScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import KayitScreen from './src/screens/KayitScreen';
import BasvuruScreen from './src/screens/BasvuruScreen';
import OdalarScreen from './src/screens/OdalarScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import AyarlarScreen from './src/screens/AyarlarScreen';
import OdaDetayScreen from './src/screens/OdaDetayScreen';
import AdminPanelScreen from './src/screens/AdminPanelScreen';
import TesisListScreen from './src/screens/TesisListScreen';
import ToplulukScreen from './src/screens/ToplulukScreen';
import BildirimlerScreen from './src/screens/BildirimlerScreen';
import PostDetayScreen from './src/screens/PostDetayScreen';
import ToplulukProfilScreen from './src/screens/ToplulukProfilScreen';
import AddRoomScreen from './src/screens/AddRoomScreen';
import PaylasimEkleScreen from './src/screens/PaylasimEkleScreen';
import ProfilDuzenleScreen from './src/screens/ProfilDuzenleScreen';
import ProfilIletisimScreen from './src/screens/ProfilIletisimScreen';
import RaporlarScreen from './src/screens/RaporlarScreen';
import MrzScanScreen from './src/features/kyc/MrzScanScreen';
import MrzResultScreen from './src/features/kyc/MrzResultScreen';
import KycSubmitScreen from './src/features/kyc/KycSubmitScreen';
import KycManualEntryScreen from './src/features/kyc/KycManualEntryScreen';
import NfcIntroScreen from './src/features/kyc/NfcIntroScreen';
import DocumentHubScreen from './src/features/documentRead/DocumentHubScreen';
import FrontDocumentScanScreen from './src/features/documentRead/FrontDocumentScanScreen';
import GallerySingleDocumentScreen from './src/features/documentRead/GallerySingleDocumentScreen';
import GalleryBatchDocumentScreen from './src/features/documentRead/GalleryBatchDocumentScreen';
import DocumentResultScreen from './src/features/documentRead/DocumentResultScreen';
import DocumentBatchResultScreen from './src/features/documentRead/DocumentBatchResultScreen';
import CameraTestScreen from './src/features/documentRead/CameraTestScreen';
import { useFocusEffect } from '@react-navigation/native';

// Misafirler sekmesi: Oteldeki mevcut kişiler (check-in yapılan misafirler) listelenir.
function MisafirlerScreen({ navigation }) {
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const [misafirler, setMisafirler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Arka planda yenileme bittiğinde listeyi güncelle (stale-while-revalidate)
  useEffect(() => {
    const unsub = dataService.subscribe('misafirler:updated', (list) => {
      setMisafirler(list || []);
    });
    return unsub;
  }, []);

  const loadMisafirler = useCallback(async (forceRefresh = true) => {
    try {
      const list = await dataService.getMisafirler(forceRefresh);
      setMisafirler(list || []);
    } catch (e) {
      setMisafirler([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const cached = dataService.getCachedMisafirler();
      if (cached && cached.length > 0) {
        setMisafirler(cached);
        setLoading(false);
      } else if (cached && cached.length === 0) {
        setMisafirler([]);
        setLoading(false);
      } else {
        setLoading(true);
      }
      loadMisafirler(true);
    }, [loadMisafirler])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMisafirler(true);
  }, [loadMisafirler]);

  const renderMisafir = useCallback(({ item }) => {
    const girisStr = item.girisTarihi
      ? new Date(item.girisTarihi).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    return (
      <View style={[styles.misafirCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.misafirCardLeft}>
          <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
          <View style={styles.misafirCardBody}>
            <Text style={[styles.misafirCardName, { color: colors.text }]} numberOfLines={1}>
              {item.ad} {item.soyad}
            </Text>
            <Text style={[styles.misafirCardOda, { color: colors.textSecondary }]}>
              Oda {item.odaNumarasi || '—'}
            </Text>
            {girisStr ? (
              <Text style={[styles.misafirCardDate, { color: colors.textSecondary }]}>
                Giriş: {girisStr}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }, [colors]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader title="Misafirler" tesis={tesis} onNotification={() => navigation.navigate('Bildirimler')} onProfile={() => navigation.navigate('ProfilDuzenle')} />
      <View style={styles.contentContainer}>
        {loading && misafirler.length === 0 ? (
          <View style={styles.misafirlerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.misafirlerLoadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
          </View>
        ) : misafirler.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Misafir Bulunamadı"
            message="Henüz kayıtlı misafir bulunmuyor. Odalar ekranından check-in yaparak misafir ekleyebilirsiniz."
            primaryCta={{ label: 'Hızlı Check-in', onPress: () => navigation.navigate('CheckIn') }}
            secondaryCta={{ label: 'Oda Ekle', onPress: () => navigation.navigate('Odalar') }}
          />
        ) : (
          <FlatList
            data={misafirler}
            renderItem={renderMisafir}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.misafirListContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4361EE',
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  screenContainer: { flex: 1 },
  mainTabsWrap: { flex: 1 },
  appLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  appLoadingText: { fontSize: 16 },
  contentContainer: { flex: 1, paddingHorizontal: 20, paddingBottom: 120 },
  misafirListContent: { paddingVertical: 12, paddingBottom: 120 },
  misafirCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 4,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  misafirCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  misafirCardBody: { marginLeft: 12, flex: 1 },
  misafirCardName: { fontSize: 16, fontWeight: '600' },
  misafirCardOda: { fontSize: 14, marginTop: 2 },
  misafirCardDate: { fontSize: 12, marginTop: 2 },
  misafirlerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  misafirlerLoadingText: { fontSize: 14 },
  mrzTabIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: -20 },
});

// Context (useAuth used in MisafirlerScreen, RaporlarScreen)
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CreditsProvider, useCredits } from './src/context/CreditsContext';
import CreditsBanner from './src/components/CreditsBanner';
import PaywallModal from './src/components/PaywallModal';
import TrialWelcomeBanner from './src/components/TrialWelcomeBanner';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_NAMES = ['Odalar', 'Misafirler', 'MRZ', 'Topluluk', 'Raporlar', 'Ayarlar'];

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { user, lastTab, setLastTab } = useAuth();
  const { colors } = useTheme();
  const isAdminPanelUser = getIsAdminPanelUser(user);
  const tabNames = isAdminPanelUser ? [...TAB_NAMES, 'AdminPanel'] : TAB_NAMES;
  const initialTab = lastTab && tabNames.includes(lastTab) ? lastTab : 'Odalar';
  const tabBarBottom = Math.max(insets.bottom, 16);

  return (
    <View style={styles.mainTabsWrap}>
      <TrialWelcomeBanner />
      <CreditsBanner />
      <Tab.Navigator
      lazy={false}
      initialRouteName={initialTab}
      screenOptions={({ route, navigation }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'MRZ') {
            return (
              <View style={[styles.mrzTabIconWrap, { backgroundColor: colors.primary }]}>
                <Ionicons name="document-text" size={26} color="#FFFFFF" />
              </View>
            );
          }
          let iconName;
          if (route.name === 'Odalar') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Okuma') iconName = focused ? 'scan' : 'scan-outline';
          else if (route.name === 'Ayarlar') iconName = focused ? 'settings' : 'settings-outline';
          else if (route.name === 'Raporlar') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Misafirler') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Topluluk') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'AdminPanel') iconName = focused ? 'shield' : 'shield-outline';
          else iconName = 'ellipse-outline';
          return <Ionicons name={iconName} size={focused ? 24 : 22} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          height: 68,
          paddingBottom: 8,
          paddingTop: 10,
          marginHorizontal: 20,
          marginBottom: tabBarBottom,
          borderRadius: 28,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarShowLabel: true,
        headerShown: false,
        listeners: ({ route }) => ({
          focus: () => setLastTab(route.name),
        }),
      })}
    >
      <Tab.Screen 
        name="Odalar" 
        component={OdalarScreen}
        options={{ tabBarLabel: 'Odalar' }}
      />
      <Tab.Screen 
        name="Misafirler" 
        component={MisafirlerScreen}
        options={{ tabBarLabel: 'Misafirler' }}
      />
      <Tab.Screen
        name="MRZ"
        component={MrzScanScreen}
        options={{
          tabBarLabel: 'MRZ Tara',
          tabBarActiveTintColor: colors.primary,
        }}
      />
      <Tab.Screen 
        name="Topluluk" 
        component={ToplulukScreen}
        options={{ tabBarLabel: 'Topluluk' }}
      />
      <Tab.Screen 
        name="Raporlar" 
        component={RaporlarScreen}
        options={{ tabBarLabel: 'Raporlar' }}
      />
      <Tab.Screen 
        name="Ayarlar" 
        component={AyarlarScreen}
        options={{ tabBarLabel: 'Ayarlar' }}
      />
      {isAdminPanelUser && (
        <Tab.Screen
          name="AdminPanel"
          component={AdminPanelScreen}
          options={{ tabBarLabel: 'Admin' }}
        />
      )}
    </Tab.Navigator>
    </View>
  );
}

function CreditsOverlay() {
  const { showPaywall, setShowPaywall, paywallReason } = useCredits();
  return (
    <PaywallModal
      visible={showPaywall}
      onClose={() => setShowPaywall(false)}
      reason={paywallReason}
    />
  );
}

const RECOVERY_PENDING_KEY = '@mykbs:auth:recovery_pending';

function parseRecoveryParams(url) {
  const hash = url?.split('#')[1];
  if (!hash) return null;
  const params = {};
  hash.split('&').forEach((part) => {
    const [k, v] = part.split('=');
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  if (params.access_token && params.refresh_token) return params;
  return null;
}

function AppLoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.appLoadingContainer, { backgroundColor: colors.background || '#f5f5f5' }]}>
      <ActivityIndicator size="large" color={colors.primary || '#4361EE'} />
      <Text style={[styles.appLoadingText, { color: colors.textSecondary || '#666' }]}>Yükleniyor...</Text>
    </View>
  );
}

function AppNavigator() {
  const { isAuthenticated, isLoading, recoverySessionPending, clearRecoveryPending } = useAuth();

  useEffect(() => {
    if (!supabase?.auth) return;
    const handleUrl = async (url) => {
      if (!url || !url.startsWith('mykbs://reset-password')) return;
      const params = parseRecoveryParams(url);
      if (!params) return;
      try {
        await AsyncStorage.setItem(RECOVERY_PENDING_KEY, '1');
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) {
          await AsyncStorage.removeItem(RECOVERY_PENDING_KEY);
          logger.error('Recovery setSession error', error);
        }
      } catch (e) {
        await AsyncStorage.removeItem(RECOVERY_PENDING_KEY);
        logger.error('Recovery handleUrl error', e);
      }
    };
    Linking.getInitialURL().then((url) => url && handleUrl(url));
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  const showRecovery = !isAuthenticated && recoverySessionPending;

  return (
    <NavigationContainer>
      {isAuthenticated && <CreditsOverlay />}
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={showRecovery ? 'ForgotPassword' : undefined}>
        {showRecovery ? (
          <>
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} initialParams={{ fromRecoveryLink: true }} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Kayit" component={KayitScreen} />
            <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
            <Stack.Screen name="Basvuru" component={BasvuruScreen} />
          </>
        ) : !isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Kayit" component={KayitScreen} />
            <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
            <Stack.Screen name="Basvuru" component={BasvuruScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="CheckIn" component={CheckInScreen} />
            <Stack.Screen name="OdaDetay" component={OdaDetayScreen} />
            <Stack.Screen name="AddRoom" component={AddRoomScreen} />
            <Stack.Screen name="PostDetay" component={PostDetayScreen} />
            <Stack.Screen name="PaylasimEkle" component={PaylasimEkleScreen} />
            <Stack.Screen name="ProfilDuzenle" component={ProfilDuzenleScreen} />
            <Stack.Screen name="ProfilIletisim" component={ProfilIletisimScreen} />
            <Stack.Screen name="ToplulukProfil" component={ToplulukProfilScreen} />
            <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
            <Stack.Screen name="TesisList" component={TesisListScreen} />
            <Stack.Screen name="Bildirimler" component={BildirimlerScreen} />
            <Stack.Screen name="MrzScan" component={MrzScanScreen} />
            <Stack.Screen name="MrzResult" component={MrzResultScreen} />
            <Stack.Screen name="KycSubmit" component={KycSubmitScreen} />
            <Stack.Screen name="KycManualEntry" component={KycManualEntryScreen} />
            <Stack.Screen name="NfcIntro" component={NfcIntroScreen} />
            <Stack.Screen name="DocumentHub" component={DocumentHubScreen} />
            <Stack.Screen name="FrontDocumentScan" component={FrontDocumentScanScreen} />
            <Stack.Screen name="GallerySingleDocument" component={GallerySingleDocumentScreen} />
            <Stack.Screen name="GalleryBatchDocument" component={GalleryBatchDocumentScreen} />
            <Stack.Screen name="DocumentResult" component={DocumentResultScreen} />
            <Stack.Screen name="DocumentBatchResult" component={DocumentBatchResultScreen} />
            <Stack.Screen name="CameraTest" component={CameraTestScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function PushRegistration() {
  const { isAuthenticated, token } = useAuth();
  useEffect(() => {
    if (isAuthenticated && token) {
      registerPushToken(async () => token).catch(() => {});
    }
  }, [isAuthenticated, token]);
  return null;
}

export default function App() {
  useEffect(() => {
    // Tek seferlik boot log
    console.log('[BOOT] EXPO_PUBLIC_BACKEND_URL=', process.env.EXPO_PUBLIC_BACKEND_URL);
    console.log('[BOOT] resolvedBackendUrl=', getApiBaseUrl());
    console.log('[BOOT] dataService mode=', dataService.getMode?.() ?? 'unknown');

    logger.log('App started', { timestamp: new Date().toISOString() });

    // Backend health check başlat
    backendHealth.startPeriodicCheck(30000); // Her 30 saniyede bir kontrol et
    
    // Backend durum değişikliğini dinle
    const unsubscribe = backendHealth.onStatusChange((status) => {
      if (!status.isOnline && status.lastChecked) {
        // Backend offline ise kullanıcıyı bilgilendir (sadece bir kere)
        logger.warn('Backend is offline', status);
      }
    });
    
    // İlk kontrolü yap
    backendHealth.checkHealth().then((status) => {
      if (!status.isOnline) {
        logger.warn('Backend is not available on app start', status);
      }
    });
    
    // Android back button handling
    if (Platform.OS === 'android') {
      const backAction = () => {
        Alert.alert(
          'Çıkış',
          'Uygulamadan çıkmak istediğinize emin misiniz?',
          [
            {
              text: 'İptal',
              onPress: () => null,
              style: 'cancel',
            },
            { text: 'Çıkış', onPress: () => BackHandler.exitApp() },
          ]
        );
        return true;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => {
        backHandler.remove();
        unsubscribe();
        backendHealth.stopPeriodicCheck();
      };
    }
    
    return () => {
      unsubscribe();
      backendHealth.stopPeriodicCheck();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <CreditsProvider>
            <PushRegistration />
            <AppNavigator />
            <Toast />
          </CreditsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

