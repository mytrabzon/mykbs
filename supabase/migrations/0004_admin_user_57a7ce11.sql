-- Admin yetkisi: 57a7ce11-b979-4614-9521-dbf12d1138e0 kullanıcısına admin rolü ver
-- Bu kullanıcı admin panel Supabase girişi ve mobil uygulamada admin butonu kullanabilir.

-- user_profiles'ta eksik kolonlar varsa ekle (edge functions select kullanıyor)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'title') THEN
    ALTER TABLE user_profiles ADD COLUMN title TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'is_disabled') THEN
    ALTER TABLE user_profiles ADD COLUMN is_disabled BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- En az bir branch olmalı (yoksa varsayılan org + branch oluştur)
DO $$
DECLARE
  org_id UUID;
  branch_id UUID;
  admin_user_id UUID := '57a7ce11-b979-4614-9521-dbf12d1138e0';
BEGIN
  SELECT id INTO branch_id FROM branches LIMIT 1;
  IF branch_id IS NULL THEN
    INSERT INTO organizations (id, name) VALUES (gen_random_uuid(), 'MyKBS') RETURNING id INTO org_id;
    INSERT INTO branches (id, organization_id, name, address) VALUES (gen_random_uuid(), org_id, 'Merkez', NULL) RETURNING id INTO branch_id;
  END IF;

  -- Bu kullanıcı auth.users'ta varsa user_profiles'a admin olarak ekle/güncelle (display_name NOT NULL)
  INSERT INTO user_profiles (user_id, branch_id, role, display_name)
  SELECT admin_user_id, branch_id, 'admin',
    COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
      u.email,
      'Admin'
    )
  FROM auth.users u
  WHERE u.id = admin_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'admin',
    display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name);
END $$;
