# Yetkili admin hesapları

Admin Panel sekmesi (tab menü) ve backend `/api/app-admin/*` erişimi aşağıdaki hesaplara açıktır.

## 1. Supabase: `profiles.is_admin`

- **Tablo:** `public.profiles` (migration `0011_profiles_is_admin.sql`), alan: `is_admin` (boolean).
- **Fonksiyon:** `public.is_admin()` — RLS policy’lerde kullanılır.
- **Backend:** `/auth/me` ve `/api/app-admin/*` bu kullanıcıyı Supabase’ten `profiles.is_admin` ile kontrol eder.
- **Mobil:** `user.is_admin === true` ise Admin sekmesi gösterilir (AuthContext’e `/auth/me` veya Edge `me` ile gelir).

## 2. UUID ile tanımlı hesaplar (Super Admin)

| UUID | Açıklama |
|------|----------|
| `f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7` | Super admin; `profiles.is_admin = true` (migration’da set edilir) |

- **Mobil:** `mobile/src/utils/adminAuth.js` → `ADMIN_PANEL_UIDS` (tab + Admin ekranı guard).
- **Backend:** `appAdmin` önce `profiles.is_admin` kontrol eder, yoksa `user_profiles.role = 'admin'` kullanılır.

## 3. Rol ile tanımlı hesaplar

- **`user.rol === 'admin'`** veya **`user.role === 'admin'`** (Supabase **`user_profiles.role = 'admin'`**) olan hesaplar da Admin Panel’i görür ve `/api/app-admin/*` kullanabilir.

## Yeni yetkili hesap ekleme

- **Supabase (önerilen):** Table Editor → `profiles` → ilgili `id` (auth.users.id) için `is_admin = true` yapın. Kayıt yoksa: `INSERT INTO public.profiles (id, is_admin) VALUES ('<uuid>', true) ON CONFLICT (id) DO UPDATE SET is_admin = true;`
- **UUID listesi (mobil):** `mobile/src/utils/adminAuth.js` içinde `ADMIN_PANEL_UIDS` dizisine yeni UUID ekleyin.
- **Rol ile:** Supabase → `user_profiles` → ilgili kullanıcıda `role = 'admin'` yapın.
