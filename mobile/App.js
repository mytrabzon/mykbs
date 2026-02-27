import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
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
import { BackHandler, Alert, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
import ToplulukScreen from './src/screens/ToplulukScreen';
import BildirimlerScreen from './src/screens/BildirimlerScreen';
import PostDetayScreen from './src/screens/PostDetayScreen';
import AddRoomScreen from './src/screens/AddRoomScreen';
import PaylasimEkleScreen from './src/screens/PaylasimEkleScreen';
import ProfilDuzenleScreen from './src/screens/ProfilDuzenleScreen';
import OkumaScreen from './src/screens/OkumaScreen';
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

// Placeholder screens for tabs (theme-aware, modern design)
function MisafirlerScreen({ navigation }) {
  const { colors } = useTheme();
  const { tesis } = useAuth();
  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader title="Misafirler" tesis={tesis} onNotification={() => navigation.navigate('Bildirimler')} onProfile={() => navigation.navigate('ProfilDuzenle')} />
      <View style={styles.contentContainer}>
        <EmptyState
          icon="people-outline"
          title="Misafir Bulunamadı"
          message="Henüz kayıtlı misafir bulunmuyor. Odalar ekranından check-in yaparak misafir ekleyebilirsiniz."
          primaryCta={{ label: 'Hızlı Check-in', onPress: () => navigation.navigate('CheckIn') }}
          secondaryCta={{ label: 'Oda Ekle', onPress: () => navigation.navigate('Odalar') }}
        />
      </View>
    </View>
  );
}

function RaporlarScreen({ navigation }) {
  const { colors } = useTheme();
  const { tesis } = useAuth();
  const reportCards = [
    { key: 'doluluk', icon: 'calendar', iconBg: colors.primarySoft, iconColor: colors.primary, label: 'Günlük Doluluk', value: '%75' },
    { key: 'gelir', icon: 'cash', iconBg: colors.successSoft, iconColor: colors.success, label: 'Aylık Gelir', value: '₺45,250' },
    { key: 'misafir', icon: 'person-add', iconBg: colors.warningSoft, iconColor: colors.warning, label: 'Yeni Misafir', value: '12' },
    { key: 'kalış', icon: 'time', iconBg: colors.errorSoft, iconColor: colors.error, label: 'Ort. Kalış', value: '3.2 gün' },
  ];
  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <AppHeader title="Raporlar" tesis={tesis} onNotification={() => navigation.navigate('Bildirimler')} onProfile={() => navigation.navigate('ProfilDuzenle')} />
      <View style={styles.reportsGrid}>
        {reportCards.map((r) => (
          <TouchableOpacity key={r.key} style={[styles.reportCardModern, { backgroundColor: colors.surface }]}>
            <View style={[styles.reportIconModern, { backgroundColor: r.iconBg }]}>
              <Ionicons name={r.icon} size={24} color={r.iconColor} />
            </View>
            <Text style={[styles.reportValueModern, { color: colors.textPrimary }]}>{r.value}</Text>
            <Text style={[styles.reportTitleModern, { color: colors.textSecondary }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.chartContainerModern, { backgroundColor: colors.surface }]}>
        <Text style={[styles.chartTitleModern, { color: colors.textPrimary }]}>Doluluk Oranı (Son 7 Gün)</Text>
        <View style={[styles.chartPlaceholderModern, { backgroundColor: colors.background }]}>
          <Text style={[styles.chartPlaceholderText, { color: colors.textSecondary }]}>Veri bekleniyor</Text>
          <Text style={[styles.chartPlaceholderSub, { color: colors.textSecondary }]}>Son 7 gün yakında</Text>
        </View>
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
  contentContainer: { flex: 1, paddingHorizontal: 20, paddingBottom: 120 },
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
    marginBottom: 0,
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
  chartPlaceholderSub: { fontSize: 12, marginTop: 4 },
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
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: { fontSize: 14 },
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

const TAB_NAMES = ['Odalar', 'Okuma', 'Misafirler', 'Topluluk', 'Bildirimler', 'Raporlar', 'Ayarlar'];

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
      initialRouteName={initialTab}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Odalar') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Okuma') iconName = focused ? 'scan' : 'scan-outline';
          else if (route.name === 'Ayarlar') iconName = focused ? 'settings' : 'settings-outline';
          else if (route.name === 'Raporlar') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Misafirler') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Topluluk') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Bildirimler') iconName = focused ? 'notifications' : 'notifications-outline';
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
        name="Okuma" 
        component={OkumaScreen}
        options={{ tabBarLabel: 'Okuma' }}
      />
      <Tab.Screen 
        name="Misafirler" 
        component={MisafirlerScreen}
        options={{
          tabBarLabel: 'Misafirler',
        }}
      />
      <Tab.Screen 
        name="Topluluk" 
        component={ToplulukScreen}
        options={{ tabBarLabel: 'Topluluk' }}
      />
      <Tab.Screen 
        name="Bildirimler" 
        component={BildirimlerScreen}
        options={{ tabBarLabel: 'Bildirimler' }}
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

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Loading screen
  }

  return (
    <NavigationContainer>
      {isAuthenticated && <CreditsOverlay />}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
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
            <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
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

