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
  ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { dataService } from '../services/dataService';
import websocketService from '../services/websocket';
import Toast from 'react-native-toast-message';
import { logger } from '../utils/logger';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { theme } from '../theme';

// Lobi — kurumsal dinamik tema (admin panel ile uyumlu)
const lobby = {
  bg: '#060810',
  surface: 'rgba(15, 23, 42, 0.92)',
  surfaceCard: 'rgba(30, 41, 59, 0.85)',
  border: 'rgba(148, 163, 184, 0.2)',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  accent: '#22d3ee',
  accentPurple: '#a78bfa',
  glow: 'rgba(34, 211, 238, 0.25)',
};

// Oda kartı için memoized component
const OdaCard = React.memo(({ item, onPress, getStatusColor, getStatusIcon, getKBSDurumIcon, getKBSDurumText }) => (
  <View style={styles.odaCard}>
    <TouchableOpacity
      style={styles.odaCardInner}
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
            <MaterialIcons name="hotel" size={32} color={theme.colors.gray400} />
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
              <Ionicons name="people-outline" size={14} color={theme.colors.textSecondary} />
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

        {/* Oda Aksiyonları */}
        <View style={styles.odaActions}>
          {item.durum === 'dolu' ? (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={onPress}
              >
                <Ionicons name="create-outline" size={16} color={theme.colors.white} />
                <Text style={styles.actionButtonText}>Düzenle</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
              onPress={() => {}}
            >
              <Ionicons name="log-in-outline" size={16} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Check-in</Text>
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
  const { tesis, token, user, isLoading: authLoading } = useAuth();
  const [odalar, setOdalar] = useState([]);
  const [ozet, setOzet] = useState(null);
  const [filtre, setFiltre] = useState('tumu');
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const appState = useRef(AppState.currentState);
  const flatListRef = useRef(null);
  
  // Memoized values
  const loading = initialLoading || filterLoading;

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

  useFocusEffect(
    React.useCallback(() => {
      // Ekran focus olduğunda verileri yenile (sadece initial loading değilse)
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
    try {
      if (isInitial) {
        setInitialLoading(true);
      }
      
      logger.log('Loading odalar data', { filtre, isInitial });
      
      // DataService kullanarak verileri çek (cache desteği ile)
      // İlk yüklemede önce cache'den dene, yoksa API'den çek
      const forceRefresh = false; // Her zaman önce cache'i kontrol et
      
      let tesis = null;
      let odalar = [];
      
      try {
        // Önce cache'den dene (hızlı yükleme için)
        tesis = await dataService.getTesis(false);
        odalar = await dataService.getOdalar(filtre, false);
        
        // Cache'den veri geldiyse kullan ve arka planda fresh data çek
        if (tesis && odalar.length > 0) {
          logger.log('Using cached data', { odaCount: odalar.length });
          setOzet(tesis.ozet);
          setOdalar(odalar);
          
          // Arka planda fresh data çek (silent refresh, hata olursa sessizce geç)
          Promise.all([
            dataService.getTesis(true).catch(() => {}),
            dataService.getOdalar(filtre, true).catch(() => {})
          ]).then(([freshTesis, freshOdalar]) => {
            if (freshTesis && freshOdalar) {
              logger.log('Silent refresh completed', { odaCount: freshOdalar.length });
              setOzet(freshTesis.ozet);
              setOdalar(freshOdalar);
            }
          }).catch(() => {
            // Silent refresh hatası, sessizce geç
          });
        } else {
          // Cache yoksa veya boşsa API'den çek
          logger.log('No cache or empty cache, fetching from API');
          const [freshTesis, freshOdalar] = await Promise.all([
            dataService.getTesis(true),
            dataService.getOdalar(filtre, true)
          ]);
          
          tesis = freshTesis;
          odalar = freshOdalar || [];
        }
      } catch (apiError) {
        logger.error('API error, trying cache fallback', apiError);
        
        // API hatası varsa cache'den dene (fallback)
        const cachedTesis = dataService.getCachedTesis();
        const cachedOdalar = dataService.getCachedOdalar(filtre);
        
        if (cachedTesis || cachedOdalar) {
          logger.log('Using cache as fallback', { 
            hasTesis: !!cachedTesis, 
            odaCount: cachedOdalar?.length || 0 
          });
          tesis = cachedTesis;
          odalar = cachedOdalar || [];
        } else {
          // Cache de yoksa hata fırlat
          throw apiError;
        }
      }

      if (tesis) {
        setOzet(tesis.ozet);
      }
      setOdalar(odalar || []);
      logger.log('Odalar data loaded successfully', { 
        odaCount: odalar?.length || 0
      });
    } catch (error) {
      logger.error('Load data error', error);
      
      // Network error için özel mesaj
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        // İlk yüklemede ise boş liste göster ve kullanıcıya bilgi ver
        if (isInitial) {
          setOdalar([]);
          setOzet(null);
          // Kullanıcıya bilgi ver (Toast gösterme, sadece log)
          logger.warn('Network error on initial load - showing empty state');
        } else {
          Toast.show({
            type: 'error',
            text1: 'Bağlantı Hatası',
            text2: 'Backend sunucusuna erişilemiyor. Lütfen backend sunucusunun çalıştığından emin olun.',
            visibilityTime: 4000,
          });
        }
      } else if (error.response?.status === 404) {
        Toast.show({
          type: 'error',
          text1: 'Endpoint bulunamadı',
          text2: error.message || 'İstenen adres mevcut değil.',
          visibilityTime: 3000,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: error.response?.status === 401 ? 'Oturum süresi doldu' : 'Hata',
          text2: error.response?.data?.message || error.message || 'Veriler yüklenemedi',
          visibilityTime: 3000,
        });
      }
    } finally {
      if (isInitial) {
        setInitialLoading(false);
      } else {
        setFilterLoading(false);
      }
      setRefreshing(false);
    }
  }, [filtre]);

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
    <OdaCard
      item={item}
      onPress={() => handleOdaPress(item)}
      getStatusColor={getStatusColor}
      getStatusIcon={getStatusIcon}
      getKBSDurumIcon={getKBSDurumIcon}
      getKBSDurumText={getKBSDurumText}
    />
  ), [handleOdaPress, getStatusColor, getStatusIcon, getKBSDurumIcon, getKBSDurumText]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);
  
  // FlatList için item layout hesaplama (optimizasyon için)
  const getItemLayout = useCallback((data, index) => ({
    length: 320, // Yaklaşık kart yüksekliği
    offset: 320 * index,
    index,
  }), []);

  const handleCheckout = async (odaId) => {
    // Check-out işlemi
    // Bu OdaDetay ekranında yapılacak
    navigation.navigate('OdaDetay', { odaId });
  };

  const [showFabMenu, setShowFabMenu] = useState(false);

  const handleAddRoom = () => {
    setShowFabMenu(false);
    Toast.show({
      type: 'info',
      text1: 'Yeni Oda Ekle',
      text2: 'Bu özellik yakında eklenecek',
      visibilityTime: 2000,
    });
    // TODO: Implement add room functionality
    // navigation.navigate('AddRoom');
  };

  const handleQuickCheckIn = () => {
    setShowFabMenu(false);
    navigation.navigate('CheckIn');
  };

  // Admin paneli - sadece bu kullanıcı (UUID ile)
  const ADMIN_USER_ID = '57a7ce11-b979-4614-9521-dbf12d1138e0';
  const isAdminUser = useMemo(() => {
    if (!user) return false;
    return user.id === ADMIN_USER_ID || user.uid === ADMIN_USER_ID;
  }, [user]);

  // Admin paneline yönlendirme
  const handleAdminPanel = useCallback(() => {
    try {
      logger.button('Admin Panel', 'clicked');
      navigation.navigate('AdminPanel');
    } catch (error) {
      logger.error('Admin panel navigation error', error);
      Toast.show({
        type: 'error',
        text1: 'Hata',
        text2: 'Admin paneline yönlendirilemedi',
        visibilityTime: 3000,
      });
    }
  }, [navigation]);

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
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={lobby.bg} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={lobby.accent} />
          <Text style={styles.loadingText}>Odalar yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={lobby.bg} />
      
      {/* Header (Lobi) — kurumsal dinamik */}
      <View style={styles.lobbyHeader}>
        <View style={styles.lobbyHeaderAccent} />
        <View style={styles.headerContent}>
          <View>
            <View style={styles.lobbyTitleRow}>
              <View style={styles.lobbyDot} />
              <Text style={styles.lobbyHeaderTitle}>Odalar</Text>
            </View>
            <Text style={styles.lobbyHeaderSubtitle}>
              {tesis?.tesisAdi || tesis?.adi || 'Tesisiniz'}
            </Text>
            {(user?.adSoyad || user?.email || user?.telefon) && (
              <Text style={styles.lobbyHeaderUserLine} numberOfLines={1}>
                {[user?.adSoyad, user?.email, user?.telefon].filter(Boolean).join(' • ')}
              </Text>
            )}
          </View>
          <View style={styles.headerButtons}>
            {isAdminUser && (
              <TouchableOpacity 
                style={[styles.lobbyHeaderButton, styles.lobbyAdminButton]}
                onPress={handleAdminPanel}
              >
                <Ionicons name="settings-outline" size={20} color={lobby.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.lobbyHeaderButton}>
              <Ionicons name="notifications-outline" size={20} color={lobby.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Özet Kartları — lobi cam kartlar */}
      {ozet && (
        <View style={styles.lobbyOzetContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ozetScroll}>
            <View style={styles.lobbyOzetCard}>
              <View style={[styles.lobbyOzetIcon, { backgroundColor: 'rgba(34, 211, 238, 0.2)' }]}>
                <Ionicons name="bed" size={20} color={lobby.accent} />
              </View>
              <Text style={styles.lobbyOzetValue}>{ozet.doluOda} / {ozet.toplamOda}</Text>
              <Text style={styles.lobbyOzetLabel}>Dolu Odalar</Text>
            </View>
            <View style={styles.lobbyOzetCard}>
              <View style={[styles.lobbyOzetIcon, { backgroundColor: 'rgba(52, 211, 153, 0.2)' }]}>
                <Ionicons name="log-in" size={20} color={theme.colors.success} />
              </View>
              <Text style={styles.lobbyOzetValue}>{ozet.bugunGiris}</Text>
              <Text style={styles.lobbyOzetLabel}>Bugün Giriş</Text>
            </View>
            <View style={styles.lobbyOzetCard}>
              <View style={[styles.lobbyOzetIcon, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
                <Ionicons name="log-out" size={20} color={theme.colors.warning} />
              </View>
              <Text style={styles.lobbyOzetValue}>{ozet.bugunCikis}</Text>
              <Text style={styles.lobbyOzetLabel}>Bugün Çıkış</Text>
            </View>
            <View style={styles.lobbyOzetCard}>
              <View style={[styles.lobbyOzetIcon, { backgroundColor: 'rgba(248, 113, 113, 0.2)' }]}>
                <Ionicons name="warning" size={20} color={theme.colors.error} />
              </View>
              <Text style={styles.lobbyOzetValue}>{ozet.hataliBildirim}</Text>
              <Text style={styles.lobbyOzetLabel}>Hatalı Bildirim</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Filtreler — lobi pill */}
      <View style={styles.lobbyFiltreContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreScroll}>
          {filterOptions.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.lobbyFiltreButton, filtre === f.key && styles.lobbyFiltreButtonActive]}
              onPress={() => {
                try {
                  logger.button('Filtre Button', 'clicked');
                  logger.log('Filter changed', { oldFiltre: filtre, newFiltre: f.key });
                  setFiltre(f.key);
                } catch (error) {
                  logger.error('Filter change error', error);
                }
              }}
            >
              <Ionicons
                name={f.icon}
                size={16}
                color={filtre === f.key ? lobby.bg : lobby.textMuted}
                style={styles.filtreIcon}
              />
              <Text style={[styles.lobbyFiltreText, filtre === f.key && styles.lobbyFiltreTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filterLoading && (
          <View style={styles.filterLoadingIndicator}>
            <ActivityIndicator size="small" color={lobby.accent} />
          </View>
        )}
      </View>

      {/* Canlı Güncellemeler — lobi stil */}
      {liveUpdates.length > 0 && (
        <View style={styles.lobbyLiveContainer}>
          <View style={styles.lobbyLiveHeader}>
            <View style={styles.liveIndicator}>
              <LiveDotPulse />
              <Text style={styles.lobbyLiveText}>CANLI</Text>
            </View>
            <Text style={styles.lobbyLiveTitle}>Son Güncellemeler</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.liveUpdatesScroll}>
            {liveUpdates.map((update, index) => (
              <View key={index} style={styles.lobbyLiveCard}>
                <View style={styles.liveUpdateHeader}>
                  <Ionicons name={update.type === 'kbs_status' ? 'shield-checkmark' : 'refresh'} size={16} color={lobby.accent} />
                  <Text style={styles.lobbyLiveUpdateRoom}>Oda {update.roomNumber}</Text>
                  <Text style={styles.lobbyLiveUpdateTime}>
                    {new Date(update.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.lobbyLiveUpdateMessage}>{update.message}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Oda Listesi */}
      <FlatList
        ref={flatListRef}
        data={odalar}
        renderItem={renderOdaCard}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[lobby.accent]}
            tintColor={lobby.accent}
          />
        }
        contentContainerStyle={[
          styles.list,
          odalar.length === 0 && styles.listEmpty
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {!initialLoading && !filterLoading ? (
              <>
                <MaterialIcons 
                  name="wifi-off" 
                  size={80} 
                  color={theme.colors.error} 
                />
                <Text style={styles.emptyTitle}>
                  Backend Bağlantı Hatası
                </Text>
                <Text style={styles.emptyText}>
                  Sunucuya bağlanılamadı.{'\n\n'}
                  Lütfen kontrol edin:{'\n'}
                  • İnternet bağlantınız açık mı?{'\n'}
                  • Uygulama ayarlarındaki Supabase adresi doğru mu?
                </Text>
                <View style={styles.emptyActions}>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      logger.log('Retry button clicked');
                      loadData(true);
                    }}
                  >
                    <Ionicons name="refresh" size={20} color={theme.colors.white} />
                    <Text style={styles.retryButtonText}>Yeniden Dene</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.retryButton, styles.retryButtonSecondary]}
                    onPress={() => {
                      logger.log('Backend check button clicked');
                      // Backend health check yap
                      import('../services/backendHealth').then(({ backendHealth }) => {
                        backendHealth.checkHealth().then((status) => {
                          if (status.isOnline) {
                            Toast.show({
                              type: 'success',
                              text1: 'Backend Çalışıyor',
                              text2: 'Bağlantı başarılı, veriler yükleniyor...',
                            });
                            loadData(true);
                          } else {
                            Toast.show({
                              type: 'error',
                              text1: 'Backend Offline',
                              text2: status.error || 'Backend sunucusuna erişilemiyor',
                            });
                          }
                        });
                      });
                    }}
                  >
                    <Ionicons name="checkmark-circle" size={20} color={theme.colors.white} />
                    <Text style={styles.retryButtonText}>Bağlantıyı Test Et</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={lobby.accent} />
                <Text style={styles.emptyTitle}>Yükleniyor...</Text>
                <Text style={styles.emptyText}>Odalar yükleniyor, lütfen bekleyin</Text>
              </>
            )}
          </View>
        }
      />

      {/* FAB Butonları */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => {
            try {
              logger.button('Refresh FAB', 'clicked');
              onRefresh();
            } catch (error) {
              logger.error('Refresh error', error);
            }
          }}
        >
          <Ionicons name="refresh" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowFabMenu(!showFabMenu)}
        >
          <Ionicons name="add" size={28} color={theme.colors.white} />
        </TouchableOpacity>

        {/* FAB Menu */}
        {showFabMenu && (
          <View style={styles.fabMenu}>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={handleAddRoom}
            >
              <View style={[styles.fabMenuIcon, { backgroundColor: theme.colors.primary }]}>
                <Ionicons name="add-circle" size={20} color={theme.colors.white} />
              </View>
              <Text style={styles.fabMenuText}>Yeni Oda Ekle</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={handleQuickCheckIn}
            >
              <View style={[styles.fabMenuIcon, { backgroundColor: theme.colors.success }]}>
                <Ionicons name="log-in" size={20} color={theme.colors.white} />
              </View>
              <Text style={styles.fabMenuText}>Hızlı Check-in</Text>
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
  container: {
    flex: 1,
    backgroundColor: lobby.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: lobby.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.base,
    fontSize: theme.typography.fontSize.base,
    color: lobby.textMuted,
  },
  // ——— Lobi header (kurumsal dinamik) ———
  lobbyHeader: {
    backgroundColor: lobby.surface,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.base,
    borderBottomLeftRadius: theme.spacing.borderRadius.xl,
    borderBottomRightRadius: theme.spacing.borderRadius.xl,
    borderBottomWidth: 1,
    borderBottomColor: lobby.border,
    overflow: 'hidden',
    position: 'relative',
  },
  lobbyHeaderAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: lobby.accent,
    opacity: 0.8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPadding,
  },
  lobbyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  lobbyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: lobby.accent,
    shadowColor: lobby.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  lobbyHeaderTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: lobby.text,
  },
  lobbyHeaderSubtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: lobby.textMuted,
    marginTop: 2,
  },
  lobbyHeaderUserLine: {
    fontSize: theme.typography.fontSize.xs,
    color: lobby.textMuted,
    opacity: 0.9,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  lobbyHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lobbyAdminButton: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
    borderWidth: 1,
    borderColor: lobby.border,
  },
  // ——— Lobi özet kartları ———
  lobbyOzetContainer: {
    paddingVertical: theme.spacing.base,
  },
  ozetScroll: {
    paddingHorizontal: theme.spacing.screenPadding,
  },
  lobbyOzetCard: {
    width: 112,
    backgroundColor: lobby.surfaceCard,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.base,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: lobby.border,
  },
  lobbyOzetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  lobbyOzetValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: lobby.text,
    marginBottom: 2,
  },
  lobbyOzetLabel: {
    fontSize: theme.typography.fontSize.xs,
    color: lobby.textMuted,
  },
  // ——— Lobi filtreler ———
  lobbyFiltreContainer: {
    paddingBottom: theme.spacing.base,
  },
  filtreScroll: {
    paddingHorizontal: theme.spacing.screenPadding,
  },
  lobbyFiltreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.spacing.borderRadius.full,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: 8,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: lobby.border,
  },
  lobbyFiltreButtonActive: {
    backgroundColor: lobby.accent,
    borderColor: lobby.accent,
  },
  filtreIcon: {
    marginRight: theme.spacing.xs,
  },
  lobbyFiltreText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: lobby.textMuted,
  },
  lobbyFiltreTextActive: {
    color: lobby.bg,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  // ——— Lobi canlı güncellemeler ———
  lobbyLiveContainer: {
    marginHorizontal: theme.spacing.screenPadding,
    marginBottom: theme.spacing.base,
    backgroundColor: lobby.surfaceCard,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.base,
    borderWidth: 1,
    borderColor: lobby.border,
  },
  lobbyLiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  lobbyLiveText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: lobby.accent,
    marginLeft: theme.spacing.xs,
  },
  lobbyLiveTitle: {
    fontSize: theme.typography.fontSize.sm,
    color: lobby.textMuted,
    marginLeft: theme.spacing.base,
  },
  lobbyLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: lobby.accent,
  },
  lobbyLiveCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: theme.spacing.borderRadius.base,
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    minWidth: 160,
  },
  lobbyLiveUpdateRoom: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: lobby.text,
    marginLeft: theme.spacing.xs,
  },
  lobbyLiveUpdateTime: {
    fontSize: theme.typography.fontSize.xs,
    color: lobby.textMuted,
    marginLeft: 'auto',
  },
  lobbyLiveUpdateMessage: {
    fontSize: theme.typography.fontSize.xs,
    color: lobby.textMuted,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: theme.spacing.screenPadding,
    paddingBottom: theme.spacing['4xl'],
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing['4xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: lobby.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.base,
    color: lobby.textMuted,
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
    backgroundColor: lobby.accent,
    borderRadius: theme.spacing.borderRadius.base,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.base,
    gap: theme.spacing.sm,
    minWidth: 180,
  },
  retryButtonSecondary: {
    backgroundColor: theme.colors.gray600,
  },
  retryButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.white,
  },
  odaCard: {
    marginBottom: theme.spacing.base,
    ...theme.spacing.shadow.lg,
  },
  odaCardInner: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.spacing.borderRadius.lg,
    overflow: 'hidden',
  },
  odaImageContainer: {
    height: 140,
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
    backgroundColor: theme.colors.white,
    borderRadius: theme.spacing.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    ...theme.spacing.shadow.sm,
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
    backgroundColor: theme.colors.white,
    borderRadius: theme.spacing.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    gap: 4,
    ...theme.spacing.shadow.sm,
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
    gap: theme.spacing.base,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.spacing.borderRadius.base,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
    gap: theme.spacing.xs,
    minHeight: 36,
  },
  actionButtonPrimary: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonSuccess: {
    backgroundColor: theme.colors.success,
  },
  actionButtonFull: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.xs,
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
    bottom: theme.spacing.screenPadding,
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.spacing.shadow.lg,
  },
  fabSecondary: {
    backgroundColor: theme.colors.secondary,
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  fabMenu: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    backgroundColor: theme.colors.white,
    borderRadius: theme.spacing.borderRadius.lg,
    padding: theme.spacing.base,
    minWidth: 180,
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
    zIndex: 1,
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

