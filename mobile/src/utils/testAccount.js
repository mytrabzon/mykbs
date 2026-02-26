// Test Hesabı Yönetimi
// Bir cihazdan bir kere test hesabı oluşturulur, 1 saat sonra kapanır
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logger } from './logger';

const TEST_ACCOUNT_KEY = 'test_account_data';
const TEST_ACCOUNT_EXPIRY_KEY = 'test_account_expiry';
const TEST_ACCOUNT_DEVICE_KEY = 'test_account_device';

// Test hesabı süresi: 1 saat (3600000 ms)
const TEST_ACCOUNT_DURATION = 60 * 60 * 1000;

export const testAccountManager = {
  // Test hesabı oluştur
  createTestAccount: async () => {
    try {
      logger.log('Creating test account');
      
      // Cihaz ID'si al (daha önce kaydedilmişse onu kullan, yoksa yeni oluştur)
      let deviceId = await AsyncStorage.getItem('device_unique_id');
      if (!deviceId) {
        deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_unique_id', deviceId);
      }
      
      // Daha önce bu cihazdan test hesabı oluşturulmuş mu kontrol et
      const existingDeviceId = await AsyncStorage.getItem(TEST_ACCOUNT_DEVICE_KEY);
      if (existingDeviceId && existingDeviceId === deviceId) {
        // Mevcut test hesabı var mı kontrol et
        const expiry = await AsyncStorage.getItem(TEST_ACCOUNT_EXPIRY_KEY);
        if (expiry && new Date(expiry) > new Date()) {
          logger.log('Test account already exists and is still valid');
          const accountData = await AsyncStorage.getItem(TEST_ACCOUNT_KEY);
          return JSON.parse(accountData);
        }
      }
      
      // Test hesabı bilgileri
      const testAccount = {
        tesisKodu: `TEST${Date.now().toString().slice(-6)}`,
        pin: '123456',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + TEST_ACCOUNT_DURATION).toISOString()
      };
      
      // Kaydet
      await AsyncStorage.setItem(TEST_ACCOUNT_KEY, JSON.stringify(testAccount));
      await AsyncStorage.setItem(TEST_ACCOUNT_EXPIRY_KEY, testAccount.expiresAt);
      await AsyncStorage.setItem(TEST_ACCOUNT_DEVICE_KEY, deviceId);
      
      logger.log('Test account created', { 
        tesisKodu: testAccount.tesisKodu,
        expiresAt: testAccount.expiresAt 
      });
      
      return testAccount;
    } catch (error) {
      logger.error('Error creating test account', error);
      throw error;
    }
  },
  
  // Test hesabı bilgilerini al
  getTestAccount: async () => {
    try {
      const accountData = await AsyncStorage.getItem(TEST_ACCOUNT_KEY);
      if (!accountData) {
        return null;
      }
      
      const account = JSON.parse(accountData);
      const expiry = new Date(account.expiresAt);
      
      // Süresi dolmuş mu kontrol et
      if (expiry <= new Date()) {
        logger.log('Test account expired, removing');
        await testAccountManager.clearTestAccount();
        return null;
      }
      
      return account;
    } catch (error) {
      logger.error('Error getting test account', error);
      return null;
    }
  },
  
  // Test hesabı var mı kontrol et
  hasTestAccount: async () => {
    const account = await testAccountManager.getTestAccount();
    return account !== null;
  },
  
  // Test hesabını temizle
  clearTestAccount: async () => {
    try {
      await AsyncStorage.removeItem(TEST_ACCOUNT_KEY);
      await AsyncStorage.removeItem(TEST_ACCOUNT_EXPIRY_KEY);
      await AsyncStorage.removeItem(TEST_ACCOUNT_DEVICE_KEY);
      logger.log('Test account cleared');
    } catch (error) {
      logger.error('Error clearing test account', error);
    }
  },
  
  // Test hesabı süresini kontrol et ve otomatik temizle
  checkAndCleanExpired: async () => {
    try {
      const account = await testAccountManager.getTestAccount();
      if (!account) {
        // Hesap yoksa veya süresi dolmuşsa temizle
        await testAccountManager.clearTestAccount();
      }
    } catch (error) {
      logger.error('Error checking test account expiry', error);
    }
  }
};

