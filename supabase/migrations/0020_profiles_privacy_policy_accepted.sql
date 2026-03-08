-- Gizlilik politikası onayı: kullanıcı bir kez onayladıktan sonra lobide tekrar gösterilmez.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.privacy_policy_accepted_at IS 'Kullanıcının gizlilik politikasını kabul ettiği tarih/saat (UTC).';

CREATE INDEX IF NOT EXISTS idx_profiles_privacy_accepted
  ON public.profiles(privacy_policy_accepted_at) WHERE privacy_policy_accepted_at IS NOT NULL;
