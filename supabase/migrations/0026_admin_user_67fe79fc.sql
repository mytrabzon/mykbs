-- Admin yetkisi: 67fe79fc-b6ac-4f45-a436-88e30e3171ef kullanıcısına admin rolü ver
-- user_profiles (branch bazlı), app_roles (mobil admin butonu), profiles (admin panel) güncellenir.

DO $$
DECLARE
  branch_id UUID;
  admin_user_id UUID := '67fe79fc-b6ac-4f45-a436-88e30e3171ef';
BEGIN
  -- En az bir branch al
  SELECT id INTO branch_id FROM branches LIMIT 1;
  IF branch_id IS NULL THEN
    RETURN;
  END IF;

  -- user_profiles: mevcut kayıt varsa güncelle, yoksa ekle (auth.users'tan display_name al)
  UPDATE user_profiles SET role = 'admin' WHERE user_id = admin_user_id;
  IF NOT FOUND THEN
    INSERT INTO user_profiles (user_id, branch_id, role, display_name)
    SELECT admin_user_id, branch_id, 'admin',
      COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
        u.email,
        u.phone,
        'Admin'
      )
    FROM auth.users u
    WHERE u.id = admin_user_id;
  END IF;

  -- app_roles: mobil uygulamada Admin butonu için
  INSERT INTO public.app_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  -- profiles: admin panel Supabase girişi için is_admin
  INSERT INTO public.profiles (id, is_admin, updated_at)
  VALUES (admin_user_id, true, now())
  ON CONFLICT (id) DO UPDATE SET is_admin = true, updated_at = now();
END $$;
