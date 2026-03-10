/**
 * Gizli Admin Panel: Sadece bu tek hesap (UID) görebilir.
 * Normal kullanıcı gibi giriş yapar; sadece bu UID için header'da gizli shield butonu ve Admin Panel menüsü görünür.
 */
const SUPER_ADMIN_UID = '67fe79fc-b6ac-4f45-a436-88e30e3171ef';

export function getIsAdminPanelUser(user) {
  if (!user) return false;
  return user.id === SUPER_ADMIN_UID;
}

export { SUPER_ADMIN_UID };
