-- Kullanım şartları onayı: kullanıcı bir kez onayladıktan sonra lobide tekrar gösterilmez.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_of_service_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.terms_of_service_accepted_at IS 'Kullanıcının kullanım şartlarını kabul ettiği tarih/saat (UTC).';

CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted
  ON public.profiles(terms_of_service_accepted_at) WHERE terms_of_service_accepted_at IS NOT NULL;
