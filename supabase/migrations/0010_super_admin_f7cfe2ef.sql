-- Sınırsız admin: f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7 (905330483061)
-- Bu kullanıcı tab menüde Admin butonu ile sorunsuz giriş yapar.

DO $$
DECLARE
  branch_id UUID;
  super_admin_id UUID := 'f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7';
BEGIN
  SELECT id INTO branch_id FROM branches LIMIT 1;
  IF branch_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE user_profiles SET role = 'admin' WHERE user_id = super_admin_id;

  IF NOT FOUND THEN
    INSERT INTO user_profiles (user_id, branch_id, role, display_name)
    SELECT super_admin_id, branch_id, 'admin',
      COALESCE(
        NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
        u.phone,
        'Admin'
      )
    FROM auth.users u
    WHERE u.id = super_admin_id;
  END IF;
END $$;
