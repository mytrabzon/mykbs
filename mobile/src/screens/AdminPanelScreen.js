import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { logger } from '../utils/logger';

// WebView'ı conditional import et
let WebView = null;
try {
  WebView = require('react-native-webview').WebView;
} catch (error) {
  logger.warn('WebView modülü yüklenemedi', error);
}

export default function AdminPanelScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin panel URL – production'da env veya ayarlardan alınmalı
  const getAdminPanelUrl = () => {
    return process.env.EXPO_PUBLIC_ADMIN_PANEL_URL || 'https://admin.example.com';
  };

  const adminPanelUrl = getAdminPanelUrl();

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleReload = () => {
    setError(null);
    setLoading(true);
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    logger.error('WebView error', nativeEvent);
    setError('Admin paneline bağlanılamadı. Lütfen admin panel sunucusunun çalıştığından emin olun.');
    setLoading(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleGoBack}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Admin Paneli</Text>
        </View>
        
        <TouchableOpacity
          style={styles.reloadButton}
          onPress={handleReload}
        >
          <Ionicons name="refresh" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Bağlantı Hatası</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorUrl}>URL: {adminPanelUrl}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleReload}
          >
            <Ionicons name="refresh" size={20} color={theme.colors.white} />
            <Text style={styles.retryButtonText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView */}
      {WebView ? (
        <WebView
          source={{ uri: adminPanelUrl }}
          style={styles.webview}
          onError={handleError}
          onLoadEnd={handleLoadEnd}
          onLoadStart={() => setLoading(true)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          mixedContentMode="always"
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
        />
      ) : (
        <View style={styles.webviewErrorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.colors.error} />
          <Text style={styles.webviewErrorTitle}>WebView Modülü Yüklenemedi</Text>
          <Text style={styles.webviewErrorText}>
            WebView native modülü henüz yüklenmedi. Lütfen development build'i yükleyin.
          </Text>
          <Text style={styles.webviewErrorSubtext}>
            Bu özellik için custom build (dev client) gereklidir.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: theme.spacing.base,
    paddingHorizontal: theme.spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    ...theme.spacing.shadow.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  reloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: {
    marginTop: theme.spacing.base,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: theme.spacing.xl,
    zIndex: 1,
  },
  errorTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  webviewErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  webviewErrorTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.base,
    textAlign: 'center',
  },
  webviewErrorText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  webviewErrorSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: theme.spacing.base,
    paddingHorizontal: theme.spacing.lg,
  },
  errorUrl: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.borderRadius.base,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  retryButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
});

