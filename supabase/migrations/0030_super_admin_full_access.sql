-- Tam yetki: sonertoprak97@gmail.com (67fe79fc) — admin panel (localhost:3000) + tüm tablolar.
-- Branch yoksa sistem org/branch oluşturulur; user_profiles, profiles, app_roles güncellenir.
-- Service role backend tarafında kullanılır; client'a verilmez (güvenli).

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

DO $$
DECLARE
  admin_user_id UUID := '67fe79fc-b6ac-4f45-a436-88e30e3171ef';
  branch_id UUID;
  org_id UUID;
BEGIN
  -- 1) En az bir branch al; yoksa org + branch oluştur
  SELECT id INTO branch_id FROM public.branches LIMIT 1;
  IF branch_id IS NULL THEN
    INSERT INTO public.organizations (name) VALUES ('KBS Sistem');
    SELECT id INTO org_id FROM public.organizations ORDER BY created_at DESC LIMIT 1;
    IF org_id IS NOT NULL THEN
      INSERT INTO public.branches (organization_id, name)
      VALUES (org_id, 'Merkez')
      RETURNING id INTO branch_id;
    END IF;
  END IF;

  IF branch_id IS NULL THEN
    RAISE NOTICE 'Super admin migration: branch bulunamadi, user_profiles atlandi';
  ELSE
    -- 2) user_profiles: Edge "me" ve requireAuth için zorunlu (role admin)
    UPDATE public.user_profiles SET role = 'admin' WHERE user_id = admin_user_id;
    IF NOT FOUND THEN
      INSERT INTO public.user_profiles (user_id, branch_id, role, display_name)
      SELECT admin_user_id, branch_id, 'admin',
        COALESCE(
          NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
          u.email,
          'Admin'
        )
      FROM auth.users u
      WHERE u.id = admin_user_id;
    END IF;
  END IF;

  -- 3) profiles: backend /api/app-admin ve /api/admin JWT ile is_admin kontrolü
  INSERT INTO public.profiles (id, is_admin, updated_at)
  VALUES (admin_user_id, true, now())
  ON CONFLICT (id) DO UPDATE SET is_admin = true, updated_at = now();
  UPDATE public.profiles SET role = 'super_admin', is_super_admin = true WHERE id = admin_user_id;

  -- 4) app_roles: backend alternatif kontrol + mobil
  INSERT INTO public.app_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
END $$;

COMMENT ON COLUMN public.profiles.role IS 'user | admin | super_admin (super_admin = tam yetkili tek hesap)';
