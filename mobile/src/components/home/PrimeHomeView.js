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
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  { key: 'tumu', label: 'Tümü' },
  { key: 'bos', label: 'Boş' },
  { key: 'dolu', label: 'Dolu' },
  { key: 'temizlik', label: 'Temizlik' },
  { key: 'bakim', label: 'Bakım' },
  { key: 'cikisaYakin', label: 'Çıkışa Yakın' },
];

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <LinearGradient
      colors={[color, color + 'CC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statCard}
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
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.7}>
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

function RoomCard({ oda, colors, onPress }) {
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
  const cikisTarihi = oda.misafir?.cikisTarihi
    ? (() => {
        const d = new Date(oda.misafir.cikisTarihi);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) return 'Bugün';
        if (d.getTime() === tomorrow.getTime()) return 'Yarın';
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
          <Text style={[styles.roomStatusText, { color: c }]}>
            {durum === 'bos' ? 'BOŞ' : durum === 'dolu' ? 'DOLU' : durum === 'temizlik' ? 'TEMİZLİK' : 'BAKIM'}
          </Text>
        </View>
      </View>
      {misafirAd && (
        <View style={styles.roomGuest}>
          <Text style={[styles.guestName, { color: colors.textPrimary }]} numberOfLines={1}>{misafirAd}</Text>
          {cikisTarihi && (
            <Text style={[styles.guestTime, { color: colors.textSecondary }]}>Çıkış: {cikisTarihi}</Text>
          )}
        </View>
      )}
      {durum === 'temizlik' && (
        <View style={styles.cleaningBadge}>
          <Ionicons name="brush" size={14} color="#F59E0B" />
          <Text style={styles.cleaningText}>Temizlikte</Text>
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
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const dolulukPct = ozet?.toplamOda > 0
    ? Math.round((ozet.doluOda / ozet.toplamOda) * 100)
    : 0;
  const hotelName = tesis?.tesisAdi || tesis?.adi || 'Tesis';
  const apiUrl = getBackendUrl ? getBackendUrl() : '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      {headerContent}
      {/* Üst Bar */}
      <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 16 }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Merhaba,</Text>
          <Text style={[styles.hotelName, { color: colors.textPrimary }]}>{hotelName} 🏨</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => navigation?.navigate('Bildirimler')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation?.navigate('ProfilDuzenle')}
          >
            <LinearGradient colors={['#06B6D4', '#8B5CF6']} style={styles.profileGradient}>
              <Text style={styles.profileInitials}>KBS</Text>
            </LinearGradient>
          </TouchableOpacity>
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
          title="Doluluk"
          value={`%${dolulukPct}`}
          icon="bed-outline"
          color="#06B6D4"
          subtitle={ozet?.toplamOda != null ? `${ozet.doluOda ?? 0}/${ozet.toplamOda} oda` : ''}
        />
        <StatCard
          title="Girişler"
          value={String(ozet?.bugunGiris ?? 0)}
          icon="log-in-outline"
          color="#10B981"
          subtitle="bugün"
        />
        <StatCard
          title="Çıkışlar"
          value={String(ozet?.bugunCikis ?? 0)}
          icon="log-out-outline"
          color="#F59E0B"
          subtitle="bugün"
        />
        <StatCard
          title="Aktif"
          value={String(ozet?.aktifMisafirSayisi ?? 0)}
          icon="people-outline"
          color="#8B5CF6"
          subtitle="misafir"
        />
      </ScrollView>

      {/* Hızlı İşlemler */}
      <View style={styles.quickActions}>
        <QuickAction
          title="Aile Girişi"
          icon="people"
          color="#8B5CF6"
          onPress={() => navigation?.navigate('FamilyCheckIn')}
        />
        <QuickAction
          title="Hızlı MRZ"
          icon="camera"
          color="#06B6D4"
          onPress={() => navigation?.navigate('MrzScan', { fromCheckIn: true })}
        />
        <QuickAction
          title="Oda Ata"
          icon="bed"
          color="#10B981"
          onPress={() => navigation?.navigate('CheckIn')}
        />
        <QuickAction
          title="Tümü"
          icon="grid"
          color="#F59E0B"
          onPress={() => onFilterChange?.('tumu')}
        />
      </View>

      {/* Filtreler */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {FILTER_KEYS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.filterChip,
              {
                backgroundColor: filtre === key ? colors.primary : colors.surface,
                borderColor: filtre === key ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onFilterChange?.(key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filtre === key ? '#fff' : colors.textPrimary },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Odalar Grid */}
      <View style={styles.roomsSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>🛏️ Odalar</Text>
          <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{odalar.length} oda</Text>
        </View>

        {odalar.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bed-outline" size={60} color={colors.textDisabled} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Henüz oda yok</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Oda ekleyerek veya check-in yaparak başlayın
            </Text>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation?.navigate('AddRoom')}
            >
              <Text style={styles.emptyButtonText}>➕ Oda Ekle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.roomGrid}>
            {odalar.map((oda) => (
              <RoomCard key={oda.id} oda={oda} colors={colors} onPress={onOdaPress} />
            ))}
          </View>
        )}
      </View>

      {/* Son İşlemler */}
      {sonGirenler.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>👥 Son giriş yapanlar</Text>
          </View>
          {sonGirenler.slice(0, 6).map((m) => (
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

      {/* Durum Bilgisi */}
      {apiUrl && (
        <View style={[styles.statusBar, { borderTopColor: colors.border }]}>
          <View style={[styles.statusDot, { backgroundColor: backendOk ? '#10B981' : '#EF4444' }]} />
          <Text style={[styles.statusText, { color: backendOk ? '#10B981' : '#EF4444' }]}>
            {backendOk ? 'Health OK' : 'Bağlantı yok'}
          </Text>
          <Text style={[styles.statusUrl, { color: colors.textSecondary }]} numberOfLines={1}>
            · {apiUrl}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  greeting: { fontSize: 14 },
  hotelName: { fontSize: 24, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  notificationButton: { position: 'relative', padding: 8 },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  statTitle: { fontSize: 12, color: '#fff', opacity: 0.95 },
  statSubtitle: { fontSize: 10, color: '#fff', opacity: 0.8, marginTop: 2 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  quickAction: { alignItems: 'center', position: 'relative' },
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
  filterScroll: { marginBottom: 20 },
  filterScrollContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterText: { fontSize: 14 },
  roomsSection: { paddingHorizontal: 20, marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },
  sectionCount: { fontSize: 14 },
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
  statusUrl: { fontSize: 11, marginLeft: 4, flex: 1 },
});
