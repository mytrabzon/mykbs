-- Global admin flag: profiles tablosu (auth.users ile 1:1), is_admin ve public.is_admin()
-- Sadece UID f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7 (ve ileride eklenenler) admin olabilsin.

-- 1) profiles tablosu (yoksa oluştur)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_is_admin_idx ON public.profiles (is_admin);

-- 2) Admin kontrol fonksiyonu (RLS policy'lerde kullanılır)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 3) Super admin UID'yi işaretle (kayıt yoksa ekle)
INSERT INTO public.profiles (id, is_admin, updated_at)
VALUES ('f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7', true, now())
ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin, updated_at = EXCLUDED.updated_at;

-- 4) RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_read_all" ON public.profiles;
CREATE POLICY "profiles_admin_read_all"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Sadece admin kullanıcılar profiles güncelleyebilir (is_admin verme/ alma)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_admin_only"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (true);

COMMENT ON TABLE public.profiles IS 'Global kullanıcı bayrakları (is_admin). RLS ile is_admin() kullanılır.';
