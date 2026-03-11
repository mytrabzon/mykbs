/**
 * Gizli Admin Panel: Sadece bu tek hesap (UID) görebilir.
 * Normal kullanıcı gibi giriş yapar; sadece bu UID için header'da gizli shield butonu ve Admin Panel menüsü görünür.
 */
const SUPER_ADMIN_UID = '67fe79fc-b6ac-4f45-a436-88e30e3171ef';

export function getIsAdminPanelUser(user) {
  if (!user) return false;
  return user.id === SUPER_ADMIN_UID;
}

/**
 * Web ile aynı yetki: super_admin | admin | user | staff.
 * Backend /auth/me role döndürüyor; super_admin UID ile de eşleşirse super_admin sayılır.
 */
export function getEffectiveRole(user) {
  if (!user) return 'user';
  if (user.id === SUPER_ADMIN_UID || user.role === 'super_admin') return 'super_admin';
  return user.role || 'user';
}

/** Yetki seviyesi etiketi: receptionist = sadece bildirim, manager/admin = her şeyi görebilir */
export const ROLE_LABELS = {
  staff: 'Resepsiyonist',
  receptionist: 'Resepsiyonist',
  user: 'Kullanıcı',
  admin: 'Müdür',
  manager: 'Müdür',
  super_admin: 'Süper Admin',
};
export function getRoleLabel(user) {
  if (!user) return ROLE_LABELS.user;
  const role = getEffectiveRole(user);
  return ROLE_LABELS[role] || ROLE_LABELS.user;
}

export { SUPER_ADMIN_UID };
