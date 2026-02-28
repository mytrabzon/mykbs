/**
 * Admin Panel erişimi: profiles.is_admin, user_profiles.role = 'admin' veya yetkili UUID listesi.
 * Geliştirme modunda (__DEV__) her zaman true — mobil uygulama içi admin panele internet olmadan erişim.
 */

const ADMIN_PANEL_UIDS = [
  'f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7',
];

export function getIsAdminPanelUser(user) {
  if (__DEV__) return true;
  if (!user) return false;
  const uid = user.uid ?? user.id;
  return (
    user.is_admin === true ||
    user.rol === 'admin' ||
    user.role === 'admin' ||
    (typeof uid === 'string' && ADMIN_PANEL_UIDS.includes(uid))
  );
}
