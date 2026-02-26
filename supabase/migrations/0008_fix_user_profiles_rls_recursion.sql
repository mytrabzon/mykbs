-- RLS infinite recursion fix: user_profiles politikaları kendi tablosunu okuyordu.
-- Çözüm: Kendi satırına erişim (user_id = auth.uid()); admin kontrolü için SECURITY DEFINER fonksiyon.

-- Eski politikaları kaldır
DROP POLICY IF EXISTS "user_profiles_select_own_branch" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_all" ON user_profiles;

-- Admin kontrolü için RLS tetiklenmeyen fonksiyon (SECURITY DEFINER = definer haklarıyla çalışır, RLS atlanır)
CREATE OR REPLACE FUNCTION public.get_my_user_profile_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM user_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Kullanıcı sadece kendi profil satırını görebilir (özyineleme yok)
CREATE POLICY "user_profiles_select_own"
  ON user_profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admin kendi satırı üzerinde tüm işlemler (UPDATE/DELETE kendi satırı; INSERT service_role ile)
CREATE POLICY "user_profiles_admin_all"
  ON user_profiles FOR ALL
  USING (get_my_user_profile_role() = 'admin')
  WITH CHECK (get_my_user_profile_role() = 'admin');
