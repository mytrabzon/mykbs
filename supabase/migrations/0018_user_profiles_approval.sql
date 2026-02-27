-- user_profiles: Kullanıcı kayıt onayı (pending -> approved/rejected). Edge + RLS tek kaynak.
-- 401 = auth yok; 403 = onaysız / devre dışı.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT NULL;

COMMENT ON COLUMN public.user_profiles.approval_status IS 'pending: onay bekliyor; approved: tam erişim; rejected: reddedildi';
COMMENT ON COLUMN public.user_profiles.approved_at IS 'Admin onay zamanı';
COMMENT ON COLUMN public.user_profiles.approved_by IS 'Onaylayan admin user id';
COMMENT ON COLUMN public.user_profiles.rejected_reason IS 'Red nedeni (opsiyonel)';

-- Mevcut kayıtları onaylı kabul et (geriye dönük uyumluluk)
UPDATE public.user_profiles
SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
WHERE approval_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status
  ON public.user_profiles(approval_status);

CREATE INDEX IF NOT EXISTS idx_user_profiles_approved_at
  ON public.user_profiles(approved_at) WHERE approved_at IS NOT NULL;
