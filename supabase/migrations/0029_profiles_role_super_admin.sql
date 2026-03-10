-- Gizli admin paneli: Sadece tek hesap (versonertoprak97@gmail.com) super_admin.
-- profiles tablosuna role ve is_super_admin eklenir; sadece bu UID işaretlenir.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;

-- Sadece bu UID super_admin (mobilde gizli admin butonu + panel sadece bunda)
INSERT INTO public.profiles (id, is_admin, role, is_super_admin, updated_at)
VALUES ('67fe79fc-b6ac-4f45-a436-88e30e3171ef', true, 'super_admin', true, now())
ON CONFLICT (id) DO UPDATE SET
  role = 'super_admin',
  is_super_admin = true,
  is_admin = true,
  updated_at = now();

COMMENT ON COLUMN public.profiles.role IS 'user | admin | super_admin (super_admin = tek gizli panel hesabı)';
COMMENT ON COLUMN public.profiles.is_super_admin IS 'true ise sadece bu hesap mobilde gizli admin panelini görür';
