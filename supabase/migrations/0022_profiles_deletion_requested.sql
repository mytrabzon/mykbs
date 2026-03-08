-- Hesap silme talebi: 7 gün içinde veriler silinir; bu sürede kullanıcı giriş yapıp hesabı geri alabilir.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.deletion_requested_at IS 'Kullanıcının hesap silme talebinde bulunduğu tarih (UTC). 7 gün sonra kalıcı silme uygulanır.';

CREATE INDEX IF NOT EXISTS idx_profiles_deletion_requested
  ON public.profiles(deletion_requested_at) WHERE deletion_requested_at IS NOT NULL;
