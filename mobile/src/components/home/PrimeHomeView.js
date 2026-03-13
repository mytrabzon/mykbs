/**
 * KBS PRIME — Canlı, renkli ana sayfa görünümü
 * İstatistik kartları, hızlı işlemler, filtreler, oda grid, son işlemler
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotificationUnread } from '../../context/NotificationContext';
import { getIsAdminPanelUser } from '../../utils/adminAuth';

let LinearGradient;
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient;
} catch {
  LinearGradient = ({ colors, style, children, ...rest }) => (
    <View style={[style, { backgroundColor: colors?.[0] || '#06B6D4' }]} {...rest}>{children}</View>
  );
}

const { width } = Dimensions.get('window');
const ROOM_CARD_WIDTH = (width - 52) / 2;

const FILTER_KEYS = [
  { key: 'bos', tKey: 'home.filterBos' },
  { key: 'dolu', tKey: 'home.filterDolu' },
  { key: 'temizlik', tKey: 'home.filterTemizlik' },
  { key: 'bakim', tKey: 'home.filterBakim' },
  { key: 'cikisaYakin', tKey: 'home.filterCikisaYakin' },
];

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <LinearGradient
      colors={[color, color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.statCard, { backgroundColor: color }]}
    >
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
      {subtitle != null && subtitle !== '' && (
        <Text style={styles.statSubtitle}>{subtitle}</Text>
      )}
    </LinearGradient>
  );
}

function QuickAction({ title, icon, color, onPress, badge }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
      <View style={[styles.quickIcon, { backgroundColor: color + '25' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={styles.quickTitle} numberOfLines={1}>{title}</Text>
      {badge != null && badge !== '' && Number(badge) > 0 && (
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function RoomCard({ oda, colors, onPress, t }) {
  const durum = oda.durum || 'bos';
  const getRoomColor = () => {
    switch (durum) {
      case 'dolu': return '#EF4444';
      case 'bos': return '#10B981';
      case 'temizlik': return '#F59E0B';
      case 'bakim': return '#6B7280';
      default: return '#6B7280';
    }
  };
  const c = getRoomColor();
  const misafirAd = oda.misafir
    ? [oda.misafir.ad, oda.misafir.soyad].filter(Boolean).join(' ')
    : null;
  const statusLabel = durum === 'bos' ? t('home.roomBos') : durum === 'dolu' ? t('home.roomDolu') : durum === 'temizlik' ? t('home.roomTemizlik') : t('home.roomBakim');
  const cikisTarihi = oda.misafir?.cikisTarihi
    ? (() => {
        const d = new Date(oda.misafir.cikisTarihi);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) return t('home.today');
        if (d.getTime() === tomorrow.getTime()) return t('home.tomorrow');
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      })()
    : null;

  return (
    <TouchableOpacity
      style={[styles.roomCard, { borderLeftColor: c, backgroundColor: colors.surface }]}
      onPress={() => onPress(oda)}
      activeOpacity={0.8}
    >
      <View style={styles.roomHeader}>
        <Text style={[styles.roomNumber, { color: colors.textPrimary }]}>{oda.odaNumarasi || oda.id}</Text>
        <View style={[styles.roomStatus, { backgroundColor: c + '22' }]}>
          <Text style={[styles.roomStatusText, { color: c }]}>{statusLabel}</Text>
        </View>
      </View>
      {misafirAd && (
        <View style={styles.roomGuest}>
          <Text style={[styles.guestName, { color: colors.textPrimary }]} numberOfLines={1}>{misafirAd}</Text>
          {cikisTarihi && (
            <Text style={[styles.guestTime, { color: colors.textSecondary }]}>{t('home.checkout')}: {cikisTarihi}</Text>
          )}
        </View>
      )}
      {durum === 'temizlik' && (
        <View style={styles.cleaningBadge}>
          <Ionicons name="brush" size={14} color="#F59E0B" />
          <Text style={styles.cleaningText}>{t('home.cleaning')}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function PrimeHomeView({
  tesis,
  ozet,
  odalar = [],
  sonGirenler = [],
  filtre,
  onFilterChange,
  onOdaPress,
  onRefresh,
  refreshing = false,
  navigation,
  getBackendUrl,
  backendOk,
  headerContent,
  /** Header'dan ayrı, içerik alanında üstte gösterilecek kart (örn. bildirim izni) — header bölümünden çıkmaz */
  contentTopCard,
  /** Hamburger menüyü açar (Drawer açıkken kullanılır) */
  onOpenMenu,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { unreadCount: notificationUnreadCount } = useNotificationUnread();
  const isSuperAdmin = getIsAdminPanelUser(user);

  const dolulukPct = ozet?.toplamOda > 0
    ? Math.round((ozet.doluOda / ozet.toplamOda) * 100)
    : 0;
  const hotelName = tesis?.tesisAdi || tesis?.adi || 'Tesis';
  const displayName = [user?.ad, user?.soyad].filter(Boolean).join(' ') || user?.adSoyad || user?.display_name || 'K';
  const avatarUrl = user?.avatar_url || null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      keyboardShouldPersistTaps="always"
      nestedScrollEnabled
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      {headerContent}
      {/* Üst Bar — renkli gradient + profil resmi (dış View her zaman yükseklik alır) */}
      <View style={[styles.headerWrap, styles.headerWrapMinHeight, { paddingTop: insets.top + 12, paddingBottom: 18 }]}>
        <LinearGradient
          colors={['#06B6D4', '#8B5CF6', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.header, { paddingBottom: 0 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.headerAvatarWrap}
              onPress={() => navigation?.navigate('DahaFazla', { screen: 'Ayarlar' })}
              activeOpacity={0.9}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.headerAvatarImg} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarInitials}>{String(displayName).charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.greetingHeader}>{t('home.greeting')}</Text>
              <Text style={styles.hotelNameHeader} numberOfLines={1}>{hotelName}</Text>
              {user?.title ? (
                <Text style={styles.headerUserTitle} numberOfLines={1}>
                  {(() => {
                    const raw = String(user.title).trim();
                    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
                  })()}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={[styles.headerRight, { top: 0, bottom: 0, right: -4 }]}>
            {isSuperAdmin && (
              <TouchableOpacity
                style={styles.adminButtonWrapHeader}
                onPress={() => navigation?.navigate('AdminPanel')}
                activeOpacity={0.7}
              >
                <Ionicons name="shield" size={22} color="#FFF" />
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>A</Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconButtonHeader}
              onPress={() => navigation?.navigate('Bildirimler')}
            >
              <Ionicons name="notifications-outline" size={22} color="#FFF" />
              {notificationUnreadCount > 0 ? <View style={styles.notificationBadge} /> : null}
            </TouchableOpacity>
            {typeof onOpenMenu === 'function' && (
              <TouchableOpacity
                style={styles.iconButtonHeader}
                onPress={onOpenMenu}
                activeOpacity={0.7}
                accessibilityLabel="Menü"
              >
                <View style={styles.menuIconWrap}>
                  <View style={[styles.menuLine, styles.menuLineWhite]} />
                  <View style={[styles.menuLine, styles.menuLineMid, styles.menuLineWhite]} />
                  <View style={[styles.menuLine, styles.menuLineWhite]} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* İstatistik Kartları */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsScrollContent}
      >
        <StatCard
          title={t('home.occupancy')}
          value={`%${dolulukPct}`}
          icon="bed-outline"
          color="#06B6D4"
          subtitle={ozet?.toplamOda != null ? `${ozet.doluOda ?? 0}/${ozet.toplamOda} ${t('home.roomCount')}` : ''}
        />
        <StatCard
          title={t('home.checkIns')}
          value={String(ozet?.bugunGiris ?? 0)}
          icon="log-in-outline"
          color="#10B981"
          subtitle={t('home.todayLabel')}
        />
        <StatCard
          title={t('home.checkOuts')}
          value={String(ozet?.bugunCikis ?? 0)}
          icon="log-out-outline"
          color="#F59E0B"
          subtitle={t('home.todayLabel')}
        />
        <StatCard
          title={t('home.active')}
          value={String(ozet?.aktifMisafirSayisi ?? 0)}
          icon="people-outline"
          color="#8B5CF6"
          subtitle={t('home.guestLabel')}
        />
      </ScrollView>

      {/* Hızlı İşlemler — zIndex ile üstte kalır, Tümü vb. tıklanabilir */}
      <View style={[styles.quickActions, { zIndex: 10 }]} pointerEvents="box-none">
        <QuickAction
          title={t('home.quickFamily')}
          icon="people"
          color="#8B5CF6"
          onPress={() => navigation?.navigate('FamilyCheckIn')}
        />
        <QuickAction
          title={t('home.quickMrz')}
          icon="camera"
          color="#06B6D4"
          onPress={() => navigation?.navigate('MrzScan', { fromCheckIn: true })}
        />
        <QuickAction
          title={t('home.quickAssignRoom')}
          icon="bed"
          color="#10B981"
          onPress={() => navigation?.navigate('MrzScan', { fromCheckIn: true })}
        />
        <QuickAction
          title={t('home.quickKaydedilenler')}
          icon="document-text-outline"
          color="#6B7280"
          onPress={() => navigation?.navigate('Kaydedilenler')}
        />
      </View>

      {/* Filtreler — Pressable + always tap: ScrollView dokunmaları çalmadan butonlar tetiklensin */}
      <View style={styles.filterRowWrap} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
        >
          {FILTER_KEYS.map(({ key, tKey }) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: filtre === key ? colors.primary : colors.surface,
                  borderColor: filtre === key ? colors.primary : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => {
                if (typeof onFilterChange === 'function') onFilterChange(key);
              }}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filtre === key ? '#fff' : colors.textPrimary },
                ]}
              >
                {t(tKey)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* İçerik üstü kart (bildirim izni vb.) — header'dan ayrı, ekranda kart olarak */}
      {contentTopCard ? (
        <View style={styles.contentTopCardWrap}>
          {contentTopCard}
        </View>
      ) : null}

      {/* Odalar Grid */}
      <View style={styles.roomsSection}>
        <View style={[styles.sectionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconWrap, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="bed-outline" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {(() => {
                const s = t('home.roomsTitle');
                return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
              })()}
            </Text>
          </View>
          <View style={[styles.sectionCountPill, { backgroundColor: colors.textPrimary + '12' }]}>
            <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{odalar.length} {t('home.roomCount')}</Text>
          </View>
        </View>

        {odalar.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bed-outline" size={60} color={colors.textDisabled} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('home.noRoomsYet')}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('home.noRoomsHint')}
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation?.navigate('AddRoom')}
            >
              <Text style={styles.emptyButtonText}>➕ {t('home.addRoom')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.roomGrid}>
            {odalar.map((oda) => (
              <RoomCard key={oda.id} oda={oda} colors={colors} onPress={onOdaPress} t={t} />
            ))}
          </View>
        )}
      </View>

      {/* Son İşlemler */}
      {sonGirenler.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>👥 {t('home.recentTitle')}</Text>
          </View>
          {sonGirenler.slice(0, 10).map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.recentItem, { borderBottomColor: colors.border }]}
              onPress={() => m.odaId && navigation?.navigate('OdaDetay', { odaId: m.odaId })}
              activeOpacity={0.7}
            >
              <View style={styles.recentLeft}>
                <View style={[styles.recentIcon, { backgroundColor: '#10B98122' }]}>
                  <Ionicons name="log-in" size={20} color="#10B981" />
                </View>
                <View>
                  <Text style={[styles.recentName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.ad} {m.soyad}
                  </Text>
                  <Text style={[styles.recentDetail, { color: colors.textSecondary }]}>
                    Oda {m.odaNumarasi || '—'} · {m.uyruk || '—'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.recentTime, { color: colors.textSecondary }]}>
                {m.girisTarihi
                  ? new Date(m.girisTarihi).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                  : '—'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Durum Bilgisi — sadece Health OK / Bağlantı yok */}
      <View style={[styles.statusBar, { borderTopColor: colors.border }]}>
        <View style={[styles.statusDot, { backgroundColor: backendOk ? '#10B981' : '#EF4444' }]} />
        <Text style={[styles.statusText, { color: backendOk ? '#10B981' : '#EF4444' }]}>
          {backendOk ? 'Health OK' : 'Bağlantı yok'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrap: {
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 0 : 6,
    overflow: 'hidden',
    backgroundColor: '#06B6D4',
  },
  headerWrapMinHeight: { minHeight: 76 },
  header: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, gap: 12 },
  headerAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  headerAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  headerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitials: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  headerTitleBlock: { flex: 1, minWidth: 0 },
  greetingHeader: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 2 },
  hotelNameHeader: { fontSize: 20, fontWeight: '700', color: '#FFF', letterSpacing: -0.2 },
  headerUserTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: -0.2, marginTop: 4, paddingLeft: 0, textAlign: 'left' },
  greeting: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 2, opacity: 0.9 },
  hotelName: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  iconButtonHeader: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminButtonWrapHeader: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconWrap: { gap: 5, justifyContent: 'center', alignItems: 'center' },
  menuLine: { width: 18, height: 2, borderRadius: 1 },
  menuLineMid: { width: 14 },
  headerRight: {
    position: 'absolute',
    right: -4,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  adminButtonWrap: { position: 'relative', padding: 8 },
  menuLineWhite: { backgroundColor: '#FFF' },
  adminBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  notificationButton: { position: 'relative', padding: 8 },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  profileGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  statsScroll: { marginBottom: 20 },
  statsScrollContent: { paddingHorizontal: 20, paddingRight: 8 },
  statCard: {
    width: 140,
    height: 120,
    borderRadius: 20,
    padding: 16,
    marginRight: 12,
    justifyContent: 'space-between',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  statTitle: { fontSize: 12, color: '#fff' },
  statSubtitle: { fontSize: 10, color: '#fff', marginTop: 2 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  quickAction: { alignItems: 'center', position: 'relative', minWidth: 56, minHeight: 64, justifyContent: 'flex-start' },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  quickTitle: { fontSize: 11, color: '#1F2937', fontWeight: '500', maxWidth: 72 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  filterRowWrap: { minHeight: 52, marginBottom: 8 },
  contentTopCardWrap: { marginBottom: 16 },
  filterScroll: { marginBottom: 12 },
  filterScrollContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center', minHeight: 48 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  filterText: { fontSize: 14 },
  roomsSection: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  sectionCountPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  roomCard: {
    width: ROOM_CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomNumber: { fontSize: 20, fontWeight: 'bold' },
  roomStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  roomStatusText: { fontSize: 10, fontWeight: '600' },
  roomGuest: { marginBottom: 6 },
  guestName: { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  guestTime: { fontSize: 12 },
  cleaningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B22',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  cleaningText: { fontSize: 10, color: '#F59E0B', fontWeight: '500' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  emptyText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  emptyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  recentSection: { paddingHorizontal: 20, marginBottom: 20 },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  recentLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentName: { fontSize: 14, fontWeight: '500' },
  recentDetail: { fontSize: 12, marginTop: 2 },
  recentTime: { fontSize: 12 },
  viewAllText: { fontSize: 14, fontWeight: '500' },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '500' },
});
