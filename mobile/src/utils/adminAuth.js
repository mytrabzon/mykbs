/**
 * Admin Panel erişimi: Sadece sunucunun döndüğü is_admin veya role = 'admin' ile belirlenir.
 * /auth/me cevabındaki kullanici.is_admin ve kullanici.role kullanılır; böylece normal
 * kullanıcılar asla Admin Panel butonunu görmez.
 */

export function getIsAdminPanelUser(user) {
  if (!user) return false;
  return user.is_admin === true || user.role === 'admin' || user.rol === 'admin';
}
