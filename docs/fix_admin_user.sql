-- Admin panel girişi için sonertoprak97@gmail.com (67fe79fc) düzeltmesi.
-- Supabase Dashboard → SQL Editor → bu dosyanın içeriğini yapıştırıp Run.
-- "Kullanici profili bulunamadi" veya "Bu hesap admin yetkisine sahip değil" alıyorsanız bunu çalıştırın.

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

  -- 2) user_profiles: Edge "me" için zorunlu (yoksa 403 Kullanici profili bulunamadi)
  IF branch_id IS NOT NULL THEN
    UPDATE public.user_profiles SET role = 'admin', display_name = COALESCE(NULLIF(TRIM(display_name), ''), 'Admin')
    WHERE user_id = admin_user_id;
    IF NOT FOUND THEN
      INSERT INTO public.user_profiles (user_id, branch_id, role, display_name, approval_status)
      SELECT admin_user_id, branch_id, 'admin',
        COALESCE(
          NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
          NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
          u.email,
          'Admin'
        ),
        'approved'
      FROM auth.users u
      WHERE u.id = admin_user_id;
    ELSE
      UPDATE public.user_profiles SET approval_status = 'approved' WHERE user_id = admin_user_id AND (approval_status IS NULL OR approval_status != 'approved');
    END IF;
  END IF;

  -- 3) profiles: admin panel "Bu hesap admin yetkisine sahip değil" için
  INSERT INTO public.profiles (id, is_admin, role, is_super_admin, updated_at)
  VALUES (admin_user_id, true, 'super_admin', true, now())
  ON CONFLICT (id) DO UPDATE SET
    is_admin = true,
    role = 'super_admin',
    is_super_admin = true,
    updated_at = now();

  -- 4) app_roles
  INSERT INTO public.app_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
END $$;
