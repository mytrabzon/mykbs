/**
 * Hamburger menü — Web'deki 14 ana sekmeye mobilde erişim.
 * Yetki: getEffectiveRole (super_admin | admin | user) ile filtreleme.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getEffectiveRole, getIsAdminPanelUser } from '../utils/adminAuth';

// Web'deki sırayla: Dashboard, Canlı Akış, Müşteriler, Lisanslar, Destek, Onay Bekleyenler, Kullanıcılar, Kimlik & Pasaport, Paketler & Ödemeler, Tesis Listesi, Bildirim & Duyurular, Raporlar, Ayarlar, Audit Log
const MENU_ITEMS = [
  { name: 'Dashboard', icon: 'home-outline', screen: 'Main', roles: ['user', 'admin', 'super_admin'] },
  { name: 'Canlı Akış', icon: 'radio-outline', screen: 'LiveStream', roles: ['admin', 'super_admin'] },
  { name: 'Müşteriler (B2B)', icon: 'people-outline', screen: 'Musteriler', roles: ['admin', 'super_admin'] },
  { name: 'Lisanslar', icon: 'card-outline', screen: 'Lisanslar', roles: ['super_admin'] },
  { name: 'Destek', icon: 'help-buoy-outline', screen: 'Destek', roles: ['user', 'admin', 'super_admin'] },
  { name: 'Onay Bekleyenler', icon: 'time-outline', screen: 'PendingUsers', roles: ['admin', 'super_admin'] },
  { name: 'Kullanıcılar', icon: 'person-outline', screen: 'Users', roles: ['admin', 'super_admin'] },
  { name: 'Kimlik & Pasaport', icon: 'document-text-outline', screen: 'Identity', roles: ['user', 'admin', 'super_admin'] },
  { name: 'Paketler & Ödemeler', icon: 'cash-outline', screen: 'Payments', roles: ['admin', 'super_admin'] },
  { name: 'Tesis Listesi', icon: 'business-outline', screen: 'Tesisler', roles: ['admin', 'super_admin'] },
  { name: 'Bildirim & Duyurular', icon: 'notifications-outline', screen: 'Notifications', roles: ['user', 'admin', 'super_admin'] },
  { name: 'Raporlar', icon: 'stats-chart-outline', screen: 'Reports', roles: ['admin', 'super_admin'] },
  { name: 'Ayarlar', icon: 'settings-outline', screen: 'Ayarlar', roles: ['user', 'admin', 'super_admin'] },
  { name: 'Admin Paneli', icon: 'shield-outline', screen: 'AdminPanel', roles: ['super_admin'] },
  { name: 'Audit Log', icon: 'list-outline', screen: 'AuditLog', roles: ['super_admin'] },
];

export default function DrawerMenu(props) {
  const { state, navigation: drawerNav } = props;
  const fallbackNav = useNavigation();
  const nav = drawerNav || fallbackNav;
  const closeDrawer = () => {
    try {
      if (typeof nav.closeDrawer === 'function') {
        nav.closeDrawer();
      } else {
        fallbackNav.dispatch(DrawerActions.closeDrawer());
      }
    } catch (_) {
      fallbackNav.dispatch(DrawerActions.closeDrawer());
    }
  };
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const role = getEffectiveRole(user);
  const isSuperAdmin = getIsAdminPanelUser(user);

  const visibleItems = MENU_ITEMS.filter((item) =>
    item.roles.includes(role) || (item.roles.includes('super_admin') && isSuperAdmin)
  );

  const handleItemPress = (screen) => {
    if (screen === 'Main') {
      nav.navigate('Main');
      closeDrawer();
      return;
    }
    // Önce hedef ekrana git; drawer kapanınca geçiş kaybolmasın diye önce navigate
    nav.navigate(screen);
    setTimeout(() => closeDrawer(), 50);
  };

  const handleLogout = async () => {
    closeDrawer();
    try {
      await logout();
    } catch (e) {
      // ignore
    }
  };

  const displayName = [user?.ad, user?.soyad].filter(Boolean).join(' ') || user?.adSoyad || user?.display_name || 'Kullanıcı';
  const roleLabel = isSuperAdmin ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Kullanıcı';
  const avatarUrl = user?.avatar_url || null;

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.background,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom,
        minHeight: WINDOW_HEIGHT,
      },
    ]}>
      <View style={[styles.profile, { borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{String(displayName).charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <Text style={[styles.userName, { color: colors.textPrimary }]} numberOfLines={1}>{displayName}</Text>
        {user?.title ? (
          <Text style={[styles.userTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {(() => {
              const raw = String(user.title).trim();
              return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '';
            })()}
          </Text>
        ) : null}
        {user?.email ? (
          <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>{user.email}</Text>
        ) : null}
        <View style={[styles.roleBadge, { backgroundColor: colors.primary + '22' }]}>
          <Text style={[styles.roleText, { color: colors.primary }]}>{roleLabel}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.menuList}
        contentContainerStyle={styles.menuListContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleItems.map((item) => {
          const currentRoute = state?.routes?.[state?.index]?.name;
          const isActive = currentRoute === item.screen;
          return (
            <TouchableOpacity
              key={item.screen}
              style={[
                styles.menuItem,
                { backgroundColor: isActive ? colors.primary + '18' : 'transparent' },
                !isActive && { borderLeftColor: 'transparent' },
                isActive && { borderLeftColor: colors.primary, borderLeftWidth: 3 },
              ]}
              onPress={() => handleItemPress(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBox, { backgroundColor: isActive ? colors.primary + '25' : colors.textPrimary + '10' }]}>
                <Ionicons name={item.icon} size={22} color={isActive ? colors.primary : colors.textSecondary} />
              </View>
              <Text style={[styles.menuText, { color: isActive ? colors.primary : colors.textPrimary, fontWeight: isActive ? '600' : '500' }]}>{item.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[styles.logout, { borderTopColor: colors.border, backgroundColor: (colors.error || '#EF4444') + '08' }]} onPress={handleLogout} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={22} color={colors.error || '#EF4444'} />
        <Text style={[styles.logoutText, { color: colors.error || '#EF4444' }]}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  profile: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#fff' },
  userName: { fontSize: 19, fontWeight: '600', marginBottom: 4 },
  userTitle: { fontSize: 13, marginBottom: 4 },
  userEmail: { fontSize: 13, marginBottom: 10 },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  roleText: { fontSize: 12, fontWeight: '600' },
  menuList: { flex: 1 },
  menuListContent: { paddingVertical: 16, paddingHorizontal: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 14,
    marginBottom: 4,
    borderLeftWidth: 0,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { fontSize: 16, flex: 1 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  logoutText: { fontSize: 16, fontWeight: '600' },
});
