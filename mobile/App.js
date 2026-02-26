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
import { logger } from './src/utils/logger';
import { backendHealth } from './src/services/backendHealth';
import { registerPushToken } from './src/services/pushNotifications';
import { BackHandler, Alert, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

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
import MrzScanScreen from './src/features/kyc/MrzScanScreen';
import MrzResultScreen from './src/features/kyc/MrzResultScreen';
import KycSubmitScreen from './src/features/kyc/KycSubmitScreen';
import KycManualEntryScreen from './src/features/kyc/KycManualEntryScreen';
import NfcIntroScreen from './src/features/kyc/NfcIntroScreen';

// Placeholder screens for tabs (theme-aware)
function MisafirlerScreen({ navigation }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.screenHeader, { backgroundColor: colors.surface }]}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Misafirler</Text>
        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>Aktif ve geçmiş misafirleriniz</Text>
      </View>
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
  const reportCards = [
    { key: 'doluluk', icon: 'calendar', iconBg: colors.primarySoft, iconColor: colors.primary, label: 'Günlük Doluluk', value: '%75' },
    { key: 'gelir', icon: 'cash', iconBg: colors.successSoft, iconColor: colors.success, label: 'Aylık Gelir', value: '₺45,250' },
    { key: 'misafir', icon: 'person-add', iconBg: colors.warningSoft, iconColor: colors.warning, label: 'Yeni Misafir', value: '12' },
    { key: 'kalış', icon: 'time', iconBg: colors.errorSoft, iconColor: colors.error, label: 'Ort. Kalış', value: '3.2 gün' },
  ];
  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <View style={[styles.screenHeader, { backgroundColor: colors.surface }]}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Raporlar</Text>
        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>Tesis performans analizleri</Text>
      </View>
      <View style={styles.reportsGrid}>
        {reportCards.map((r) => (
          <TouchableOpacity key={r.key} style={[styles.reportCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.reportIcon, { backgroundColor: r.iconBg }]}>
              <Ionicons name={r.icon} size={24} color={r.iconColor} />
            </View>
            <Text style={[styles.reportValue, { color: colors.textPrimary }]}>{r.value}</Text>
            <Text style={[styles.reportTitle, { color: colors.textSecondary }]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={[styles.chartContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.chartTitle, { color: colors.textPrimary }]}>Doluluk Oranı (Son 7 Gün)</Text>
        <View style={[styles.chartPlaceholder, { backgroundColor: colors.background }]}>
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
  screenHeader: {
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '600',
    marginBottom: 4,
  },
  screenSubtitle: { fontSize: 14 },
  contentContainer: { flex: 1, paddingHorizontal: 20 },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  reportCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 13,
    marginTop: 4,
  },
  reportValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  chartPlaceholderSub: {
    fontSize: 12,
    marginTop: 4,
  },
  chartContainer: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  chartPlaceholder: {
    height: 200,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: { fontSize: 14 },
});

// Context
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_NAMES = ['Odalar', 'Misafirler', 'Topluluk', 'Bildirimler', 'Raporlar', 'Ayarlar'];

const ADMIN_PANEL_USER_UID = 'f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7';

function MainTabs() {
  const { user, lastTab, setLastTab } = useAuth();
  const { colors } = useTheme();
  const isAdminPanelUser = !!user && (user.id === ADMIN_PANEL_USER_UID || user.uid === ADMIN_PANEL_USER_UID);
  const tabNames = isAdminPanelUser ? [...TAB_NAMES, 'AdminPanel'] : TAB_NAMES;
  const initialTab = lastTab && tabNames.includes(lastTab) ? lastTab : 'Odalar';

  return (
    <Tab.Navigator
      initialRouteName={initialTab}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Odalar') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Ayarlar') iconName = focused ? 'settings' : 'settings-outline';
          else if (route.name === 'Raporlar') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Misafirler') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Topluluk') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Bildirimler') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'AdminPanel') iconName = focused ? 'shield' : 'shield-outline';
          else iconName = 'ellipse-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 12,
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
        options={{
          tabBarLabel: 'Odalar',
        }}
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
  );
}

function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Loading screen
  }

  return (
    <NavigationContainer>
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
            <Stack.Screen name="PostDetay" component={PostDetayScreen} />
            <Stack.Screen name="AdminPanel" component={AdminPanelScreen} />
            <Stack.Screen name="MrzScan" component={MrzScanScreen} />
            <Stack.Screen name="MrzResult" component={MrzResultScreen} />
            <Stack.Screen name="KycSubmit" component={KycSubmitScreen} />
            <Stack.Screen name="KycManualEntry" component={KycManualEntryScreen} />
            <Stack.Screen name="NfcIntro" component={NfcIntroScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function PushRegistration() {
  const { isAuthenticated, getSupabaseToken } = useAuth();
  useEffect(() => {
    if (isAuthenticated && getSupabaseToken) {
      registerPushToken(getSupabaseToken).catch(() => {});
    }
  }, [isAuthenticated, getSupabaseToken]);
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
          <PushRegistration />
          <AppNavigator />
          <Toast />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

