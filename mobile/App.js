import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import ErrorBoundary from './src/components/ErrorBoundary';
import { logger } from './src/utils/logger';
import { backendHealth } from './src/services/backendHealth';
import { registerPushToken } from './src/services/pushNotifications';
import { BackHandler, Alert, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import OTPVerifyScreen from './src/screens/OTPVerifyScreen';
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

// Placeholder screens for tabs
function MisafirlerScreen({ navigation }) {
  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Misafirler</Text>
        <Text style={styles.screenSubtitle}>Aktif ve geçmiş misafirleriniz</Text>
      </View>
      
      <View style={styles.contentContainer}>
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={80} color="#CCCCCC" />
          <Text style={styles.emptyStateTitle}>Misafir Bulunamadı</Text>
          <Text style={styles.emptyStateText}>
            Henüz kayıtlı misafir bulunmuyor. Yeni misafir eklemek için Odalar ekranından Check-in yapabilirsiniz.
          </Text>
        </View>
      </View>
    </View>
  );
}

function RaporlarScreen({ navigation }) {
  return (
    <View style={styles.screenContainer}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Raporlar</Text>
        <Text style={styles.screenSubtitle}>Tesis performans analizleri</Text>
      </View>
      
      <View style={styles.reportsGrid}>
        <TouchableOpacity style={styles.reportCard}>
          <View style={[styles.reportIcon, { backgroundColor: '#4361EE15' }]}>
            <Ionicons name="calendar" size={24} color="#4361EE" />
          </View>
          <Text style={styles.reportTitle}>Günlük Doluluk</Text>
          <Text style={styles.reportValue}>%75</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.reportCard}>
          <View style={[styles.reportIcon, { backgroundColor: '#4CAF5015' }]}>
            <Ionicons name="cash" size={24} color="#4CAF50" />
          </View>
          <Text style={styles.reportTitle}>Aylık Gelir</Text>
          <Text style={styles.reportValue}>₺45,250</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.reportCard}>
          <View style={[styles.reportIcon, { backgroundColor: '#FF980015' }]}>
            <Ionicons name="person-add" size={24} color="#FF9800" />
          </View>
          <Text style={styles.reportTitle}>Yeni Misafir</Text>
          <Text style={styles.reportValue}>12</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.reportCard}>
          <View style={[styles.reportIcon, { backgroundColor: '#F4433615' }]}>
            <Ionicons name="time" size={24} color="#F44336" />
          </View>
          <Text style={styles.reportTitle}>Ort. Kalış</Text>
          <Text style={styles.reportValue}>3.2 gün</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Doluluk Oranı (Son 7 Gün)</Text>
        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartPlaceholderText}>Grafik gösterimi yakında eklenecek</Text>
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
  screenContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  screenHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  screenSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  reportCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
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
    color: '#666666',
    marginBottom: 4,
  },
  reportValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: '#999999',
  },
});

// Context
import { AuthProvider, useAuth } from './src/context/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_NAMES = ['Odalar', 'Misafirler', 'Topluluk', 'Bildirimler', 'Raporlar', 'Ayarlar'];

function MainTabs() {
  const { lastTab, setLastTab } = useAuth();
  const initialTab = lastTab && TAB_NAMES.includes(lastTab) ? lastTab : 'Odalar';

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
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4361EE',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 65,
          paddingBottom: 10,
          paddingTop: 10,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
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
      <AuthProvider>
        <PushRegistration />
        <AppNavigator />
        <Toast />
      </AuthProvider>
    </ErrorBoundary>
  );
}

