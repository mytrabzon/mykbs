import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  StatusBar,
  Animated,
  Dimensions,
  AppState,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api, getBackendUrl, getApiErrorMessage } from '../services/api';
import { getHealthUrl, getApiDebugInfo, isSupabaseConfigured } from '../config/api';
import { dataService } from '../services/dataService';
import { backendHealth } from '../services/backendHealth';
import websocketService from '../services/websocket';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { theme, spacing } from '../theme';
import AppHeader from '../components/AppHeader';
import BackendErrorScreen from '../components/BackendErrorScreen';

// Oda kartı — modern tasarım (onCheckout: listeden tek tıkla misafir çıkışı)
const OdaCard = React.memo(({ item, onPress, onCheckout, getStatusColor, getStatusIcon, getKBSDurumIcon, getKBSDurumText }) => (
  <View style={styles.odaCard}>
    <TouchableOpacity
      style={[styles.odaCardInner, { borderLeftWidth: 4, borderLeftColor: getStatusColor(item.durum) }]}
      activeOpacity={0.9}
      onPress={onPress}
    >
      {/* Oda Görseli */}
      <View style={styles.odaImageContainer}>
        {item.fotograf ? (
          <Image 
            source={{ uri: item.fotograf }} 
            style={styles.odaFoto}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.odaPlaceholder}>
            <MaterialIcons name="hotel" size={22} color={theme.colors.gray400} />
          </View>
        )}
        <View style={styles.odaImageOverlay} />
        
        {/* Oda Numarası */}
        <View style={styles.odaNumberBadge}>
          <Text style={styles.odaNumberText} numberOfLines={1}>Oda {item.odaNumarasi}</Text>
        </View>
        
        {/* Oda Durumu */}
        <View style={[styles.odaStatusBadge, { backgroundColor: getStatusColor(item.durum) }]}>
          {getStatusIcon(item.durum)}
          <Text style={styles.odaStatusText} numberOfLines={1}>
            {item.durum === 'bos' ? 'Boş' : 
             item.durum === 'dolu' ? 'Dolu' : 
             item.durum === 'temizlik' ? 'Temizlik' : 
             item.durum === 'bakim' ? 'Bakım' : 'Bilinmiyor'}
          </Text>
        </View>
      </View>

      {/* Oda Detayları */}
      <View style={styles.odaContent}>
        <View style={styles.odaHeader}>
          <View style={styles.odaHeaderLeft}>
            <Text style={styles.odaTipi} numberOfLines={1}>{item.odaTipi || 'Standart Oda'}</Text>
            <View style={styles.odaCapacity}>
              <Ionicons name="people-outline" size={10} color={theme.colors.textSecondary} />
              <Text style={styles.odaCapacityText}>{item.kapasite || 2} Kişi</Text>
            </View>
          </View>
          <View style={styles.odaPrice}>
            <Text style={styles.odaPriceText}>₺{item.fiyat || '0'}</Text>
            <Text style={styles.odaPriceLabel}>/gece</Text>
          </View>
        </View>

        {/* Misafir Bilgileri — şu anda odada (tek kaynak: uygulama, KBS gecikmesi yok) */}
        {(item.odadaMi || (item.durum === 'dolu' && item.misafir)) && (
          <View style={styles.misafirInfo}>
            <View style={styles.misafirHeader}>
              <Ionicons name="person-circle-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.misafirAd} numberOfLines={1}>
                {item.misafir.ad} {item.misafir.soyad}
              </Text>
              <View style={styles.odadaBadge}>
                <Text style={styles.odadaBadgeText}>Şu anda odada</Text>
              </View>
            </View>
            
            <View style={styles.misafirDetails}>
              <View style={styles.misafirDetail}>
                <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.misafirDetailText} numberOfLines={1}>
                  Giriş: {new Date(item.misafir.girisTarihi).toLocaleDateString('tr-TR')}
                </Text>
              </View>
              
              {item.misafir.cikisTarihi && (
                <View style={styles.misafirDetail}>
                  <Ionicons name="calendar-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.misafirDetailText} numberOfLines={1}>
                    Çıkış: {new Date(item.misafir.cikisTarihi).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
              )}
            </View>

            {/* KBS Durumu */}
            {item.kbsDurumu && (
              <View style={styles.kbsDurum}>
                <View style={styles.kbsDurumHeader}>
                  {getKBSDurumIcon(item.kbsDurumu)}
                  <Text style={styles.kbsDurumText} numberOfLines={1}>
                    {getKBSDurumText(item.kbsDurumu)}
                  </Text>
                </View>
                {item.kbsHataMesaji && (
                  <Text style={styles.kbsHataText} numberOfLines={2}>{item.kbsHataMesaji}</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Oda Aksiyonları — dolu odada: tek tıkla Çıkış + Düzenle */}
        <View style={styles.odaActions}>
          {item.durum === 'dolu' && item.misafir && !item.misafir.cikisTarihi ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonCheckout]}
                onPress={(e) => { e?.stopPropagation?.(); onCheckout?.(item); }}
              >
                <Ionicons name="log-out-outline" size={16} color={theme.colors.white} />
                <Text style={styles.actionButtonText}>Çıkış</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={onPress}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.white} />
                <Text style={styles.actionButtonText}>Detay</Text>
              </TouchableOpacity>
            </>
          ) : item.durum !== 'dolu' ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
              onPress={onPress}
            >
              <Ionicons name="log-in-outline" size={16} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Check-in</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
              onPress={onPress}
            >
              <Ionicons name="create-outline" size={16} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Detay</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  </View>
));

// Lobi CANLI noktası — nabız animasyonu
function LiveDotPulse() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[styles.lobbyLiveDot, { opacity }]} />;
}

export default function OdalarScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { tesis, token, user, isLoading: authLoading, logout } = useAuth();
  const [odalar, setOdalar] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [filtre, setFiltre] = useState('tumu');
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [backendStatus, setBackendStatus] = useState({ isOnline: null, lastChecked: null, error: null, dbOnline: undefined });
  const [supabaseStatus, setSupabaseStatus] = useState({ configured: false, isOnline: null, lastChecked: null, error: null });
  const [lastLoadErrorType, setLastLoadErrorType] = useState(null); // 'auth' | 'network' | 'path' | 'db' | 'approval' | 'forbidden' | 'server' | null
  const [lastErrorPayload, setLastErrorPayload] = useState(null); // { requestId, message, code }
  const [showDebugUrls, setShowDebugUrls] = useState(__DEV__);
  const appState = useRef(AppState.currentState);
  const flatListRef = useRef(null);
  const loadTimeoutRef = useRef(null);
  const filtreRef = useRef(filtre);
  useEffect(() => {
    filtreRef.current = filtre;
  }, [filtre]);

  const loading = initialLoading || filterLoading;

  // Arka planda tesis/odalar yenilendiğinde ekranı güncelle (stale-while-revalidate)
  useEffect(() => {
    const unsubTesis = dataService.subscribe('tesis:updated', (tesisData) => {
      if (tesisData?.ozet) setOzet(tesisData.ozet);
    });
    const unsubOdalar = dataService.subscribe('odalar:updated', ({ filtre: updatedFiltre, odalar: freshOdalar }) => {
      if (updatedFiltre === filtreRef.current && Array.isArray(freshOdalar)) setOdalar(freshOdalar);
    });
    return () => {
      unsubTesis();
      unsubOdalar();
    };
  }, []);

  // Backend health dinle: test başarılı olunca state resetlensin (sticky overlay kalkar)
  useEffect(() => {
    const unsub = backendHealth.onStatusChange((status) => {
      setBackendStatus((p) => ({
        ...p,
        isOnline: status.isOnline,
        lastChecked: status.lastChecked,
        error: status.error,
        dbOnline: status.dbOnline,
      }));
      if (status.isOnline && status.dbOnline === false) {
        setLastLoadErrorType('db');
      } else if (status.isOnline) {
        setLastLoadErrorType(null);
      }
    });
    return unsub;
  }, []);

  // Supabase health: mount'ta bir kez kontrol + dinleyici
  useEffect(() => {
    setSupabaseStatus(backendHealth.getSupabaseStatus());
    const unsub = backendHealth.onSupabaseStatusChange((status) => {
      setSupabaseStatus(status);
    });
    if (isSupabaseConfigured()) {
      backendHealth.checkSupabaseHealth();
    }
    return unsub;
  }, []);

  // İlk açılışta backend durumunu güncelle (header noktaları için)
  useEffect(() => {
    const run = async () => {
      if (getBackendUrl()) {
        const status = await backendHealth.checkHealth();
        setBackendStatus((p) => ({
          ...p,
          isOnline: status.isOnline,
          lastChecked: status.lastChecked,
          error: status.error,
          dbOnline: status.dbOnline,
        }));
        if (status.isOnline && status.dbOnline === false) setLastLoadErrorType('db');
        else if (status.isOnline) setLastLoadErrorType(null);
      }
    };
    run();
  }, []);

  // Mount: AppState listener + cleanup
  useEffect(() => {
    logger.log('OdalarScreen mounted');
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      logger.log('OdalarScreen unmounted');
      subscription.remove();
      cleanupWebSocket();
    };
  }, []);

  // Session hazır olduktan sonra ilk veri yüklemesi (auth restore bitmeden API çağırma)
  useEffect(() => {
    if (authLoading) return;
    loadData(true);
  }, [authLoading]);

  // Filtre değiştiğinde
  useEffect(() => {
    if (!initialLoading) {
      logger.log('Filter changed', { filtre });
      loadData(false);
    }
  }, [filtre]);

  const isFirstFocus = useRef(true);
  useFocusEffect(
    React.useCallback(() => {
      // İlk açılışta loadData(true) zaten çalışıyor; sadece ekrana geri dönüşte yenile (silinen oda hemen kalkar)
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return () => {};
      }
      if (!initialLoading) {
        loadData(false);
      }
      return () => {};
    }, [initialLoading, loadData])
  );

  const setupWebSocket = () => {
    if (!token) {
      logger.warn('No token available for WebSocket connection');
      return;
    }

    try {
      // WebSocket URL'sini API base URL'den oluştur
      const wsUrl = api.defaults.baseURL
        .replace('http://', 'ws://')
        .replace('https://', 'wss://') + '/ws';
      
      logger.log('Setting up WebSocket', { wsUrl });
      websocketService.connect(wsUrl, token);

      // WebSocket event listeners
      const unsubscribeConnected = websocketService.on('connected', () => {
        logger.log('WebSocket connected successfully');
        Toast.show({
          type: 'success',
          text1: 'Canlı Güncelleme Aktif',
          text2: 'Oda durumları anlık olarak güncelleniyor',
          visibilityTime: 2000,
        });
        
        // Tüm odalara subscribe ol
        websocketService.subscribeToAllRooms();
      });

      const unsubscribeDisconnected = websocketService.on('disconnected', (event) => {
        logger.log('WebSocket disconnected', event);
        if (!event.wasClean) {
          Toast.show({
            type: 'error',
            text1: 'Bağlantı Kesildi',
            text2: 'Canlı güncellemeler geçici olarak durduruldu',
            visibilityTime: 3000,
          });
        }
      });

      const unsubscribeRoomUpdate = websocketService.on('room:update', (data) => {
        logger.log('Room update received', data);
        handleRoomUpdate(data);
      });

      const unsubscribeKBSStatus = websocketService.on('room:kbs:status', (data) => {
        logger.log('KBS status update received', data);
        handleKBSStatusUpdate(data);
      });

      const unsubscribeError = websocketService.on('error', (error) => {
        logger.error('WebSocket error received', error);
      });

      // Cleanup fonksiyonları
      return () => {
        unsubscribeConnected();
        unsubscribeDisconnected();
        unsubscribeRoomUpdate();
        unsubscribeKBSStatus();
        unsubscribeError();
        websocketService.disconnect();
      };
    } catch (error) {
      logger.error('WebSocket setup error', error);
    }
  };

  const cleanupWebSocket = () => {
    websocketService.disconnect();
  };

  const handleAppStateChange = useCallback((nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App foreground'a geldiğinde verileri yenile
      logger.log('App came to foreground, refreshing data');
      if (!initialLoading) {
        loadData(false);
      }
    }
    appState.current = nextAppState;
  }, [initialLoading, loadData]);

  const handleRoomUpdate = (data) => {
    setOdalar(prevOdalar => {
      const updatedOdalar = prevOdalar.map(oda => {
        if (oda.id === data.roomId) {
          // Canlı güncelleme bildirimi ekle
          addLiveUpdate({
            type: 'room_update',
            roomId: data.roomId,
            roomNumber: oda.odaNumarasi,
            message: `Oda ${oda.odaNumarasi} güncellendi`,
            timestamp: new Date().toISOString(),
          });

          return { ...oda, ...data };
        }
        return oda;
      });

      // Özet verilerini de güncelle
      if (data.durum) {
        updateOzet(data);
      }

      return updatedOdalar;
    });
  };

  const handleKBSStatusUpdate = (data) => {
    setOdalar(prevOdalar => {
      const updatedOdalar = prevOdalar.map(oda => {
        if (oda.id === data.roomId) {
          // Canlı güncelleme bildirimi ekle
          addLiveUpdate({
            type: 'kbs_status',
            roomId: data.roomId,
            roomNumber: oda.odaNumarasi,
            status: data.status,
            message: `Oda ${oda.odaNumarasi} KBS durumu: ${data.status}`,
            timestamp: new Date().toISOString(),
          });

          return { 
            ...oda, 
            kbsDurumu: data.status,
            kbsHataMesaji: data.error 
          };
        }
        return oda;
      });

      return updatedOdalar;
    });
  };

  const addLiveUpdate = (update) => {
    setLiveUpdates(prev => {
      const newUpdates = [update, ...prev.slice(0, 4)]; // Son 5 güncellemeyi tut
      return newUpdates;
    });

    // 5 saniye sonra güncellemeyi kaldır
    setTimeout(() => {
      setLiveUpdates(prev => prev.filter(u => u !== update));
    }, 5000);
  };

  const updateOzet = (roomData) => {
    setOzet(prevOzet => {
      if (!prevOzet) return prevOzet;

      let newOzet = { ...prevOzet };
      
      // Oda durumuna göre özeti güncelle
      // Burada backend'den gelen gerçek verilere göre güncelleme yapılmalı
      // Şimdilik basit bir güncelleme yapıyoruz
      
      return newOzet;
    });
  };

  const loadData = useCallback(async (isInitial = false) => {
    const LOAD_STEP = { START: 'start', TESIS_CACHE: 'tesis_cache', ODALAR_CACHE: 'odalar_cache', TESIS_FRESH: 'tesis_fresh', ODALAR_FRESH: 'odalar_fresh', APPLY: 'apply' };
    let lastLoadStep = LOAD_STEP.START;
    try {
      if (isInitial) {
        setInitialLoading(true);
        if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = setTimeout(() => {
          loadTimeoutRef.current = null;
          setInitialLoading(false);
          setFilterLoading(false);
          setRefreshing(false);
          logger.warn('[OdalarScreen] loadData timeout – showing screen so user is not stuck');
        }, 15000);
      }
      logger.log('[OdalarScreen] loadData başladı', { filtre, isInitial });

      let tesis = null;
      let odalar = [];

      try {
        lastLoadStep = LOAD_STEP.TESIS_CACHE;
        logger.log('[OdalarScreen] adım: tesis (cache)', { step: lastLoadStep });
        tesis = await dataService.getTesis(false);
        lastLoadStep = LOAD_STEP.ODALAR_CACHE;
        logger.log('[OdalarScreen] adım: odalar (cache)', { step: lastLoadStep, filtre });
        odalar = await dataService.getOdalar(filtre, false);

        if (tesis && odalar.length > 0) {
          logger.log('[OdalarScreen] cache dolu, ekranda gösteriliyor; arka planda taze veri çekiliyor', { odaCount: odalar.length });
          setOzet(tesis.ozet);
          setOdalar(odalar);
          Promise.all([
            dataService.getTesis(true).catch((e) => { logger.warn('[OdalarScreen] silent refresh tesis hatası', e?.message || e); }),
            dataService.getOdalar(filtre, true).catch((e) => { logger.warn('[OdalarScreen] silent refresh odalar hatası', e?.message || e, e?.step); })
          ]).then(([freshTesis, freshOdalar]) => {
            if (freshTesis && freshOdalar) {
              logger.log('[OdalarScreen] silent refresh tamamlandı', { odaCount: freshOdalar.length });
              setOzet(freshTesis.ozet);
              setOdalar(freshOdalar);
            }
          }).catch((e) => { logger.warn('[OdalarScreen] silent refresh genel hata', e?.message || e); });
        } else {
          lastLoadStep = LOAD_STEP.TESIS_FRESH;
          logger.log('[OdalarScreen] cache yok/boş, API ile taze veri', { step: lastLoadStep });
          const [freshTesis, freshOdalar] = await Promise.all([
            dataService.getTesis(true),
            dataService.getOdalar(filtre, true)
          ]);
          lastLoadStep = LOAD_STEP.ODALAR_FRESH;
          tesis = freshTesis;
          odalar = freshOdalar || [];
          logger.log('[OdalarScreen] taze veri alındı', { step: lastLoadStep, odaCount: odalar?.length ?? 0 });
        }
      } catch (apiError) {
        const step = apiError?.step ?? lastLoadStep;
        logger.error('[OdalarScreen] API hatası, adım:', step, {
          message: apiError?.message,
          status: apiError?.response?.status,
          code: apiError?.response?.data?.code,
        }, apiError);
        const cachedTesis = dataService.getCachedTesis();
        const cachedOdalar = dataService.getCachedOdalar(filtre);
        if (cachedTesis || cachedOdalar) {
          logger.log('[OdalarScreen] cache fallback kullanılıyor', { hasTesis: !!cachedTesis, odaCount: cachedOdalar?.length || 0 });
          tesis = cachedTesis;
          odalar = cachedOdalar || [];
        } else {
          Object.assign(apiError, { loadStep: step });
          throw apiError;
        }
      }

      lastLoadStep = LOAD_STEP.APPLY;
      if (tesis) setOzet(tesis.ozet);
      setOdalar(odalar || []);
      if ((odalar || []).length > 0) setBackendStatus((p) => ({ ...p, isOnline: true }));
      logger.log('[OdalarScreen] loadData tamamlandı', { step: lastLoadStep, odaCount: (odalar || []).length });
    } catch (error) {
      const loadStep = error?.loadStep ?? error?.step ?? error?.response?.data?.step ?? lastLoadStep;
      logger.error('[OdalarScreen] loadData hatası', {
        loadStep,
        message: error?.message,
        status: error?.response?.status,
        code: error?.response?.data?.code,
      }, error);
      const status = error.response?.status ?? error.status;
      const data = error.response?.data || {};
      const code = data.code || null;
      let serverMsg = data.message || data.error || error.message;
      if (loadStep && !serverMsg.includes('yüklenirken') && !serverMsg.includes('adım')) {
        serverMsg = `${serverMsg} (adım: ${loadStep})`;
      }
      const requestId = data.requestId || null;

      const isAuth = status === 401;
      const isPath = status === 404;
      const isApproval = status === 409 || (status === 403 && code === 'APPROVAL_REQUIRED');
      const isForbidden = status === 403;
      const isNetwork =
        error.message === 'Network Error' ||
        error.code === 'ERR_NETWORK' ||
        (status >= 500 && status < 600);
      const isDbError = status === 500 && (code === 'DB_CONNECT_ERROR' || code === 'SCHEMA_ERROR' || code === 'MISSING_DATABASE_URL');
      const isServerError = status === 500 && !isDbError;

      setLastErrorPayload(requestId || serverMsg ? { requestId, message: serverMsg, code } : null);

      if (isAuth) {
        setLastLoadErrorType(null);
        if (typeof logout === 'function') logout();
        return;
      }
      if (isApproval) {
        setLastLoadErrorType('approval');
        setBackendStatus((p) => ({ ...p, isOnline: true }));
        if (!isInitial) Toast.show({ type: 'info', text1: 'Onay Bekleniyor', text2: serverMsg, visibilityTime: 4000 });
        return;
      }
      if (isForbidden) {
        setLastLoadErrorType('forbidden');
        setBackendStatus((p) => ({ ...p, isOnline: true }));
        if (!isInitial) Toast.show({ type: 'error', text1: 'Yetki yok', text2: serverMsg, visibilityTime: 4000 });
        return;
      }
      if (isPath) {
        setLastLoadErrorType('path');
        setBackendStatus((p) => ({ ...p, isOnline: true }));
        return;
      }
      if (isNetwork) {
        setLastLoadErrorType(isDbError ? 'db' : isServerError ? 'server' : 'network');
        if (isInitial) {
          setOdalar([]);
          setOzet(null);
          setBackendStatus({ isOnline: status < 500, lastChecked: new Date(), error: serverMsg });
        } else {
          Toast.show({
            type: 'error',
            text1: isDbError ? 'Sunucu hatası' : isServerError ? 'Sunucu hatası' : 'Bağlantı Hatası',
            text2: serverMsg || (status >= 500 ? 'Sunucuda sorun var. Daha sonra tekrar deneyin.' : 'Sunucuya erişilemiyor.'),
            visibilityTime: 5000,
          });
        }
        return;
      }
      setLastLoadErrorType('server');
      Toast.show({ type: 'error', text1: 'Hata', text2: serverMsg || getApiErrorMessage(error), visibilityTime: 3000 });
    } finally {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      if (isInitial) {
        setInitialLoading(false);
      } else {
        setFilterLoading(false);
      }
      setRefreshing(false);
    }
  }, [filtre, logout]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, [loadData]);

  // Memoized helper functions
  const getKBSDurumIcon = useCallback((durum) => {
    switch (durum) {
      case 'basarili':
        return <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />;
      case 'beklemede':
        return <Ionicons name="time-outline" size={16} color={theme.colors.warning} />;
      case 'hatali':
        return <Ionicons name="close-circle" size={16} color={theme.colors.error} />;
      default:
        return null;
    }
  }, []);

  const getKBSDurumText = useCallback((durum) => {
    switch (durum) {
      case 'basarili':
        return 'Bildirildi';
      case 'beklemede':
        return 'Beklemede';
      case 'hatali':
        return 'Hatalı';
      default:
        return '';
    }
  }, []);

  const getStatusColor = useCallback((durum) => {
    switch (durum) {
      case 'bos':
        return theme.colors.success;
      case 'dolu':
        return theme.colors.error;
      case 'temizlik':
        return theme.colors.warning;
      case 'bakim':
        return theme.colors.gray600;
      default:
        return theme.colors.gray400;
    }
  }, []);

  const getStatusIcon = useCallback((durum) => {
    switch (durum) {
      case 'bos':
        return <Ionicons name="bed-outline" size={16} color={theme.colors.success} />;
      case 'dolu':
        return <Ionicons name="bed" size={16} color={theme.colors.error} />;
      case 'temizlik':
        return <Ionicons name="water-outline" size={16} color={theme.colors.warning} />;
      case 'bakim':
        return <Ionicons name="construct-outline" size={16} color={theme.colors.gray600} />;
      default:
        return <Ionicons name="help-circle-outline" size={16} color={theme.colors.gray400} />;
    }
  }, []);

  const handleOdaPress = useCallback((item) => {
    try {
      logger.button('Oda Card', 'clicked');
      logger.log('Navigating to OdaDetay', { odaId: item.id });
      navigation.navigate('OdaDetay', { odaId: item.id });
    } catch (error) {
      logger.error('Navigation error', error);
    }
  }, [navigation]);

  const renderOdaCard = useCallback(({ item }) => (
    <View style={styles.odaCardWrapper}>
      <OdaCard
        item={item}
        onPress={() => handleOdaPress(item)}
        onCheckout={handleCheckout}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        getKBSDurumIcon={getKBSDurumIcon}
        getKBSDurumText={getKBSDurumText}
      />
    </View>
  ), [handleOdaPress, handleCheckout, getStatusColor, getStatusIcon, getKBSDurumIcon, getKBSDurumText]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  const CARD_ROW_HEIGHT = 220;
  const getItemLayout = useCallback((data, index) => ({
    length: CARD_ROW_HEIGHT,
    offset: CARD_ROW_HEIGHT * Math.floor(index / 2),
    index,
  }), []);

  const handleCheckout = useCallback((item) => {
    if (!item?.misafir?.id) return;
    const adSoyad = [item.misafir.ad, item.misafir.soyad].filter(Boolean).join(' ') || 'Misafir';
    Alert.alert(
      'Çıkış yap',
      `${adSoyad} için misafir çıkışı yapılsın mı? Oda boşaltılır.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış yap',
          onPress: async () => {
            try {
              await api.post(`/misafir/checkout/${item.misafir.id}`);
              dataService.clearCache().catch(() => {});
              setOdalar((prev) => prev.map((o) => (o.id === item.id && o.misafir?.id === item.misafir.id
                ? { ...o, durum: 'bos', misafir: null, odadaMi: false }
                : o)));
              Toast.show({ type: 'success', text1: 'Çıkış yapıldı', text2: 'Misafir kaydı kapatıldı.' });
            } catch (err) {
              const msg = getApiErrorMessage(err) || err?.response?.data?.message || 'Çıkış yapılamadı';
              Toast.show({ type: 'error', text1: 'Hata', text2: msg });
            }
          }
        }
      ]
    );
  }, []);

  const [showFabMenu, setShowFabMenu] = useState(false);

  const handleAddRoom = () => {
    setShowFabMenu(false);
    navigation.navigate('AddRoom');
  };

  const handleQuickCheckIn = () => {
    setShowFabMenu(false);
    navigation.navigate('CheckIn');
  };

  // Memoized filter options
  const filterOptions = useMemo(() => [
    { key: 'tumu', label: 'Tümü', icon: 'grid' },
    { key: 'bos', label: 'Boş', icon: 'bed-outline' },
    { key: 'dolu', label: 'Dolu', icon: 'bed' },
    { key: 'temizlik', label: 'Temizlik', icon: 'water-outline' },
    { key: 'hatali', label: 'Hatalı', icon: 'warning-outline' },
  ], []);

  if (initialLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.background === '#0F172A' ? 'light-content' : 'dark-content'} backgroundColor={colors.primary} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Odalar yükleniyor...</Text>
        </View>
      </View>
    );
  }

  const dolulukYuzde = ozet && ozet.toplamOda > 0 ? Math.round((ozet.doluOda / ozet.toplamOda) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === '#0F172A' ? 'light-content' : 'dark-content'} backgroundColor={colors.primary} />
      <AppHeader
        minimal
        variant="primary"
        tesis={tesis}
        backendConfigured={!!getBackendUrl()}
        backendOnline={odalar.length > 0 ? true : backendStatus.isOnline}
        backendError={backendStatus.error}
        supabaseConfigured={supabaseStatus.configured}
        supabaseOnline={supabaseStatus.isOnline}
        supabaseError={supabaseStatus.error}
        onNotification={() => navigation.navigate('Bildirimler')}
        onProfile={() => navigation.navigate('ProfilDuzenle')}
      />

      {/* Oda Listesi — üst blok ListHeaderComponent içinde, tek kaydırmada kartlar yukarı gelir */}
      <FlatList
        ref={flatListRef}
        data={odalar}
        renderItem={renderOdaCard}
        keyExtractor={keyExtractor}
        numColumns={2}
        key="two-column"
        columnWrapperStyle={styles.odaColumnWrapper}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        contentContainerStyle={[styles.list, odalar.length === 0 && styles.listEmpty]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[styles.hero, { backgroundColor: colors.primary }]}>
              <Text style={styles.heroGreeting}>Hoş geldiniz</Text>
              <Text style={styles.heroTesis} numberOfLines={1}>{tesis?.tesisAdi || tesis?.adi || 'Tesis'}</Text>
              {ozet && ozet.toplamOda > 0 && (
                <View style={styles.heroStats}>
                  <Text style={styles.heroDoluluk}>{dolulukYuzde}%</Text>
                  <Text style={styles.heroLabel}>Doluluk · {ozet.doluOda}/{ozet.toplamOda} Oda</Text>
                </View>
              )}
            </View>
            {ozet && (
              <View style={[styles.ozetWrapper, { marginTop: -16 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ozetScroll} scrollEnabled={true}>
                  <TouchableOpacity style={[styles.ozetCard, { backgroundColor: colors.surface }]} onPress={() => setFiltre('dolu')} activeOpacity={0.7}>
                    <View style={[styles.ozetIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="bed" size={20} color={colors.primary} /></View>
                    <Text style={[styles.ozetValue, { color: colors.textPrimary }]}>{ozet.doluOda}/{ozet.toplamOda}</Text>
                    <Text style={[styles.ozetLabel, { color: colors.textSecondary }]}>Dolu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ozetCard, { backgroundColor: colors.surface }]} onPress={() => setFiltre('tumu')} activeOpacity={0.7}>
                    <View style={[styles.ozetIcon, { backgroundColor: colors.successSoft }]}><Ionicons name="log-in" size={20} color={colors.success} /></View>
                    <Text style={[styles.ozetValue, { color: colors.textPrimary }]}>{ozet.bugunGiris}</Text>
                    <Text style={[styles.ozetLabel, { color: colors.textSecondary }]}>Giriş</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ozetCard, { backgroundColor: colors.surface }]} onPress={() => setFiltre('tumu')} activeOpacity={0.7}>
                    <View style={[styles.ozetIcon, { backgroundColor: colors.warningSoft }]}><Ionicons name="log-out" size={20} color={colors.warning} /></View>
                    <Text style={[styles.ozetValue, { color: colors.textPrimary }]}>{ozet.bugunCikis}</Text>
                    <Text style={[styles.ozetLabel, { color: colors.textSecondary }]}>Çıkış</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ozetCard, { backgroundColor: colors.surface }]} onPress={() => setFiltre('hatali')} activeOpacity={0.7}>
                    <View style={[styles.ozetIcon, { backgroundColor: colors.errorSoft }]}><Ionicons name="warning" size={20} color={colors.error} /></View>
                    <Text style={[styles.ozetValue, { color: colors.textPrimary }]}>{ozet.hataliBildirim}</Text>
                    <Text style={[styles.ozetLabel, { color: colors.textSecondary }]}>Hatalı</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}
            <View style={styles.lobbyFiltreContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreScroll}>
                {filterOptions.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.lobbyFiltreButton, { backgroundColor: filtre === f.key ? colors.primary : colors.surface, borderColor: filtre === f.key ? colors.primary : colors.border }]}
                    onPress={() => { try { logger.button('Filtre Button', 'clicked'); setFiltre(f.key); } catch (error) { logger.error('Filter change error', error); } }}
                  >
                    <Ionicons name={f.icon} size={14} color={filtre === f.key ? colors.textInverse : colors.textSecondary} style={styles.filtreIcon} />
                    <Text style={[styles.lobbyFiltreText, { color: filtre === f.key ? colors.textInverse : colors.textSecondary }, filtre === f.key && styles.lobbyFiltreTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {filterLoading && <View style={styles.filterLoadingIndicator}><ActivityIndicator size="small" color={colors.primary} /></View>}
            </View>
            {liveUpdates.length > 0 && (
              <View style={[styles.lobbyLiveContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.lobbyLiveHeader}>
                  <View style={styles.liveIndicator}>
                    <LiveDotPulse />
                    <Text style={[styles.lobbyLiveText, { color: colors.primary }]}>CANLI</Text>
                  </View>
                  <Text style={[styles.lobbyLiveTitle, { color: colors.textSecondary }]}>Son Güncellemeler</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveUpdatesScroll}>
                  {liveUpdates.map((update, index) => (
                    <View key={index} style={[styles.lobbyLiveCard, { backgroundColor: colors.background }]}>
                      <View style={styles.liveUpdateHeader}>
                        <Ionicons name={update.type === 'kbs_status' ? 'shield-checkmark' : 'refresh'} size={14} color={colors.primary} />
                        <Text style={[styles.lobbyLiveUpdateRoom, { color: colors.textPrimary }]}>Oda {update.roomNumber}</Text>
                        <Text style={[styles.lobbyLiveUpdateTime, { color: colors.textSecondary }]}>{new Date(update.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                      <Text style={[styles.lobbyLiveUpdateMessage, { color: colors.textSecondary }]}>{update.message}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !initialLoading && !filterLoading ? (
            (backendStatus.isOnline === false || lastLoadErrorType !== null || backendStatus.dbOnline === false) ? (
              <BackendErrorScreen
                onRetry={() => loadData(true)}
                onTestConnection={async () => {
                  const status = await backendHealth.checkHealth();
                  setBackendStatus({
                    isOnline: status.isOnline,
                    lastChecked: status.lastChecked || new Date(),
                    error: status.error,
                    dbOnline: status.dbOnline,
                  });
                  if (status.isOnline && status.dbOnline !== false) {
                    setLastLoadErrorType(null);
                    Toast.show({
                      type: 'success',
                      text1: 'Bağlantı kuruldu',
                      text2: 'Veriler yeniden yükleniyor...',
                      visibilityTime: 2000,
                    });
                    loadData(true);
                  } else if (status.isOnline && status.dbOnline === false) {
                    setLastLoadErrorType('db');
                    Toast.show({
                      type: 'error',
                      text1: 'Veritabanı bağlantısı yok',
                      text2: 'Sunucu çalışıyor ama veritabanına ulaşılamıyor.',
                      visibilityTime: 4000,
                    });
                  } else {
                    setLastLoadErrorType(null);
                    Toast.show({ type: 'error', text1: 'Bağlantı başarısız', text2: status.error || 'Sunucuya erişilemiyor' });
                  }
                }}
                onOpenSettings={() => navigation.navigate('Ayarlar')}
                lastError={backendStatus.error}
                lastChecked={backendStatus.lastChecked}
                errorType={lastLoadErrorType || (backendStatus.isOnline && backendStatus.dbOnline === false ? 'db' : null)}
                testedUrl={getHealthUrl()}
                apiBaseUrl={getBackendUrl()}
                requestId={lastErrorPayload?.requestId}
                serverMessage={lastErrorPayload?.message}
                showDebug={showDebugUrls}
                onToggleDebug={() => setShowDebugUrls((v) => !v)}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="hotel" size={48} color={colors.textSecondary} style={{ marginBottom: spacing.md }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Henüz oda yok</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Oda ekleyerek veya check-in yaparak başlayın</Text>
                {__DEV__ && (() => {
                  const { healthUrl, apiBaseUrl } = getApiDebugInfo();
                  return (
                    <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: spacing.lg, fontSize: 11 }]}>
                      Health OK · API: {apiBaseUrl || '(yok)'}
                    </Text>
                  );
                })()}
              </View>
            )
          ) : (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Yükleniyor...</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Odalar yükleniyor</Text>
            </View>
          )
        }
      />

      {/* FAB — artı butonu (yenile kaldırıldı, tek FAB yukarıda) */}
      <View style={[styles.fabContainer, { zIndex: 20 }]}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowFabMenu(!showFabMenu)}>
          <Ionicons name="add" size={28} color={colors.textInverse} />
        </TouchableOpacity>
        {showFabMenu && (
          <View style={[styles.fabMenu, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.fabMenuItem} onPress={handleAddRoom}>
              <View style={[styles.fabMenuIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="add-circle" size={20} color={colors.textInverse} />
              </View>
              <Text style={[styles.fabMenuText, { color: colors.textPrimary }]}>Yeni Oda Ekle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fabMenuItem} onPress={handleQuickCheckIn}>
              <View style={[styles.fabMenuIcon, { backgroundColor: colors.success }]}>
                <Ionicons name="log-in" size={20} color={colors.textInverse} />
              </View>
              <Text style={[styles.fabMenuText, { color: colors.textPrimary }]}>Hızlı Check-in</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Overlay to close menu when clicking outside */}
      {showFabMenu && (
        <TouchableOpacity
          style={styles.fabOverlay}
          activeOpacity={1}
          onPress={() => setShowFabMenu(false)}
        />
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingContent: { alignItems: 'center' },
  loadingText: { marginTop: theme.spacing.base, fontSize: theme.typography.fontSize.base },
  hero: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 0,
  },
  heroGreeting: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  heroTesis: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  heroStats: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroDoluluk: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  heroLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  ozetWrapper: { paddingHorizontal: theme.spacing.screenPadding, marginBottom: 10 },
  ozetScroll: { paddingRight: theme.spacing.screenPadding },
  ozetCard: {
    width: 72,
    borderRadius: 14,
    padding: 8,
    marginRight: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  ozetIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  ozetValue: { fontSize: 15, fontWeight: '700', marginBottom: 1 },
  ozetLabel: { fontSize: 10, fontWeight: '500' },
  lobbyFiltreContainer: { paddingBottom: 8 },
  filtreScroll: { paddingHorizontal: theme.spacing.screenPadding },
  lobbyFiltreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 0,
  },
  filtreIcon: { marginRight: theme.spacing.xs },
  lobbyFiltreText: { fontSize: theme.typography.fontSize.xs, fontWeight: '500' },
  lobbyFiltreTextActive: { fontWeight: '600' },
  lobbyLiveContainer: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: 8,
    borderRadius: theme.spacing.borderRadius.card,
    padding: theme.spacing.sm,
    borderWidth: 1,
  },
  lobbyLiveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs },
  lobbyLiveText: { fontSize: theme.typography.fontSize.xs, fontWeight: '700', marginLeft: theme.spacing.xs },
  lobbyLiveTitle: { fontSize: theme.typography.fontSize.sm, marginLeft: theme.spacing.base },
  lobbyLiveDot: { width: 8, height: 8, borderRadius: 4 },
  lobbyLiveCard: {
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    minWidth: 160,
  },
  lobbyLiveUpdateRoom: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginLeft: theme.spacing.xs,
  },
  lobbyLiveUpdateTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginLeft: 'auto',
  },
  lobbyLiveUpdateMessage: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: 120,
    paddingTop: 4,
  },
  odaCardWrapper: {
    flex: 1,
    marginHorizontal: 4,
    marginBottom: 8,
    maxWidth: (Dimensions.get('window').width - theme.spacing.screenPadding * 2 - 16) / 2,
  },
  odaColumnWrapper: {
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing['2xl'],
    lineHeight: 22,
  },
  emptyActions: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.base,
    alignItems: 'center',
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
    minWidth: 180,
  },
  retryButtonSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  retryButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  odaCard: {
    ...theme.spacing.shadow.lg,
  },
  odaCardInner: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0,
  },
  odaImageContainer: {
    height: 88,
    position: 'relative',
  },
  odaFoto: {
    width: '100%',
    height: '100%',
  },
  odaPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  odaImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  odaNumberBadge: {
    position: 'absolute',
    top: theme.spacing.base,
    left: theme.spacing.base,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    ...theme.spacing.shadow.base,
  },
  odaNumberText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  odaStatusBadge: {
    position: 'absolute',
    top: theme.spacing.base,
    right: theme.spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    gap: 4,
    ...theme.spacing.shadow.base,
  },
  odaStatusText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  odaContent: {
    padding: theme.spacing.base,
  },
  odaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.base,
  },
  odaHeaderLeft: {
    flex: 1,
    marginRight: theme.spacing.base,
  },
  odaTipi: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  odaCapacity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  odaCapacityText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  odaPrice: {
    alignItems: 'flex-end',
  },
  odaPriceText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary,
  },
  odaPriceLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  misafirInfo: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
  },
  misafirHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
    gap: theme.spacing.sm,
  },
  misafirAd: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  odadaBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  odadaBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.success || '#22c55e',
  },
  misafirDetails: {
    gap: theme.spacing.xs,
  },
  misafirDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  misafirDetailText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  kbsDurum: {
    marginTop: theme.spacing.base,
    paddingTop: theme.spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  kbsDurumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  kbsDurumText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  kbsHataText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.error,
    fontStyle: 'italic',
  },
  odaActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.spacing.borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.xs,
    gap: 2,
    minHeight: 28,
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonCheckout: {
    backgroundColor: theme.colors.error || '#dc2626',
  },
  actionButtonSuccess: {
    backgroundColor: theme.colors.success,
  },
  actionButtonFull: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 9,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  filterLoadingIndicator: {
    position: 'absolute',
    right: theme.spacing.screenPadding,
    top: '50%',
    marginTop: -10,
  },
  listEmpty: {
    flexGrow: 1,
  },
  fabContainer: {
    position: 'absolute',
    right: theme.spacing.screenPadding,
    bottom: 130,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.spacing.shadow.lg,
  },
  fabMenu: {
    position: 'absolute',
    bottom: 64,
    right: 0,
    borderRadius: 20,
    padding: theme.spacing.base,
    minWidth: 200,
    ...theme.spacing.shadow.lg,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
  },
  fabMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  fabMenuText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
  },
  fabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  liveUpdatesContainer: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.base,
    ...theme.spacing.shadow.base,
  },
  liveUpdatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error + '15',
    borderRadius: theme.spacing.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error,
    marginRight: theme.spacing.xs,
  },
  liveText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.error,
  },
  liveUpdatesTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
  },
  liveUpdatesScroll: {
    paddingRight: theme.spacing.screenPadding,
  },
  liveUpdateCard: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.base,
    marginRight: theme.spacing.base,
    minWidth: 200,
  },
  liveUpdateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  liveUpdateRoom: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  liveUpdateTime: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  liveUpdateMessage: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
});

