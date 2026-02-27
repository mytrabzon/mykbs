import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing } from '../theme';
import { Button } from './ui/Button';

/**
 * Backend/veri hatası ekranı: tek kaynak (test URL = API base).
 * - errorType: 'auth' → oturum CTA, 'network'/'path' → backend/endpoint mesajı.
 * - Test başarılıysa parent setBackendStatus('UP') + setLastLoadErrorType(null) yapar, overlay kapanır.
 * - Debug: Test edilen adres + API adresi (aynı base olmalı).
 */
export default function BackendErrorScreen({
  onRetry,
  onTestConnection,
  onOpenSettings,
  lastError,
  lastChecked,
  showDebug = false,
  onToggleDebug,
  errorType = null, // 'auth' | 'network' | 'path' | 'db' | 'approval' | 'forbidden' | 'server' | null
  testedUrl = '',
  apiBaseUrl = '',
  requestId = null,
  serverMessage = null,
}) {
  const { colors } = useTheme();
  const [debugVisible, setDebugVisible] = useState(showDebug);

  const isAuth = errorType === 'auth';
  const isPath = errorType === 'path';
  const isDb = errorType === 'db';
  const isApproval = errorType === 'approval';
  const isForbidden = errorType === 'forbidden';
  const isServer = errorType === 'server';

  const title = isApproval
    ? 'Onay Bekleniyor'
    : isForbidden
      ? 'Yetki yok'
      : isAuth
        ? 'Oturum doğrulanamadı'
        : isPath
          ? 'Endpoint bulunamadı'
          : isDb || isServer
            ? 'Sunucu hatası'
            : 'Backend Bağlantı Hatası';
  const message = isApproval
    ? (serverMessage || 'KBS bilgileriniz veya şube atamanız admin onayından sonra aktif olacaktır.')
    : isForbidden
      ? 'Bu sayfaya erişim yetkiniz yok.'
      : isAuth
        ? 'Oturum süreniz dolmuş veya yetkiniz yok. Lütfen tekrar giriş yapın.'
        : isPath
          ? 'İstek yapılan adres sunucuda bulunamadı. Test ve API adresleri aynı base\'i kullanıyor mu kontrol edin.'
          : isDb || isServer
            ? (serverMessage || 'Sunucuda sorun var. Daha sonra tekrar deneyin.')
            : apiBaseUrl
              ? 'Sunucu adresi doğrulanamadı. İnternet bağlantınızı ve sunucu adresini kontrol edin.'
              : 'EXPO_PUBLIC_BACKEND_URL tanımlı değil. mobile/.env içinde backend adresi gerekli.';

  // Test edilen adres = health (apiBaseUrl + /health). requestId = hata veren API isteğinden (örn. /api/tesis), health ile aynı istek değil.
  const debugLines = [
    apiBaseUrl ? `API adresi (base): ${apiBaseUrl}` : null,
    testedUrl ? `Health test adresi: ${testedUrl}` : null,
    lastChecked ? `Son deneme: ${lastChecked instanceof Date ? lastChecked.toLocaleString('tr-TR') : new Date(lastChecked).toLocaleString('tr-TR')}` : null,
    lastError ? `Hata: ${lastError}` : null,
    requestId ? `Hata veren istek (requestId): ${requestId}` : null,
  ].filter(Boolean);
  const hasDebug = debugLines.length > 0;

  const copyDebug = () => {
    const text = debugLines.join('\n');
    if (Platform.OS === 'web' || !Share) return;
    Share.share({ message: text, title: 'Backend debug' }).catch(() => {});
  };

  const pillColor = isApproval || isForbidden ? colors.warningSoft : (isAuth || isDb ? colors.warningSoft : colors.errorSoft);
  const textColor = isApproval || isForbidden ? colors.warning : (isAuth || isDb ? colors.warning : colors.error);
  const iconName = isApproval ? 'time-outline' : isForbidden ? 'lock-closed-outline' : isAuth ? 'person-outline' : isDb ? 'server-outline' : 'cloud-offline-outline';

  return (
    <View style={styles.container}>
      <View style={[styles.pill, { backgroundColor: pillColor }]}>
        <Text style={[styles.pillText, { color: textColor }]}>
          {isApproval ? 'Onay' : isForbidden ? 'Yetki' : isAuth ? 'Oturum' : isDb ? 'Sunucu' : 'Offline'}
        </Text>
      </View>
      <View style={[styles.iconWrap, { backgroundColor: pillColor }]}>
        <Ionicons name={iconName} size={56} color={textColor} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

      {(debugVisible && hasDebug) && (
        <TouchableOpacity
          style={[styles.debugBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onLongPress={copyDebug}
          activeOpacity={1}
        >
          <Text style={[styles.debugLabel, { color: colors.textSecondary }]}>Detaylar (uzun basarak kopyala)</Text>
          {debugLines.map((line, i) => (
            <Text key={i} style={[styles.debugLine, { color: colors.textPrimary }]} numberOfLines={2}>
              {line}
            </Text>
          ))}
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <Button variant="primary" onPress={onRetry} style={styles.btn}>
          {isApproval ? 'Durumu Yenile' : isAuth ? 'Tekrar giriş yap' : 'Yeniden Dene'}
        </Button>
        <Button variant="secondary" onPress={onTestConnection} style={styles.btn}>
          Bağlantıyı Test Et
        </Button>
        {onOpenSettings && (
          <TouchableOpacity onPress={onOpenSettings} style={styles.tertiary}>
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
            <Text style={[styles.tertiaryText, { color: colors.primary }]}>Ayarları Aç (Backend URL)</Text>
          </TouchableOpacity>
        )}
      </View>

      {hasDebug && (
        <TouchableOpacity
          onPress={() => (onToggleDebug ? onToggleDebug() : setDebugVisible((v) => !v))}
          style={styles.showDebug}
        >
          <Text style={[styles.showDebugText, { color: colors.textSecondary }]}>
            {debugVisible ? 'Detayları gizle' : 'Detaylar'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: spacing.borderRadius.pill,
    marginBottom: spacing.lg,
  },
  pillText: {
    fontSize: typography.text.caption.fontSize,
    fontWeight: typography.fontWeight.semibold,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.text.h2Large.fontSize,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  message: {
    fontSize: typography.text.body.fontSize,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  debugBox: {
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: spacing.borderRadius.input,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  debugLabel: {
    fontSize: typography.text.caption.fontSize,
    marginBottom: spacing.xs,
  },
  debugLine: {
    fontSize: typography.text.caption.fontSize,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actions: {
    width: '100%',
    maxWidth: 320,
    gap: spacing.sm,
    alignItems: 'center',
  },
  btn: { width: '100%' },
  tertiary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  tertiaryText: {
    fontSize: typography.text.body.fontSize,
    fontWeight: typography.fontWeight.medium,
  },
  showDebug: { marginTop: spacing.lg },
  showDebugText: { fontSize: typography.text.caption.fontSize },
});
