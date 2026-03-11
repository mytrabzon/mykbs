-- Gizlilik ve kullanım şartları onay takibi (mobil uygulama açılışında gösterilir, Onayla sonrası bir daha gösterilmez).
-- profiles.privacy_policy_accepted_at ve profiles.terms_of_service_accepted_at zaten mevcut (0020, 0021).
-- Bu migration: raporlama için view ve açıklama ekler.

COMMENT ON COLUMN public.profiles.privacy_policy_accepted_at IS 'Kullanıcının gizlilik politikasını kabul ettiği tarih/saat (UTC). Mobilde ConsentGate Onayla ile set edilir; bir daha gösterilmez.';
COMMENT ON COLUMN public.profiles.terms_of_service_accepted_at IS 'Kullanıcının kullanım şartlarını kabul ettiği tarih/saat (UTC). Mobilde ConsentGate Onayla ile set edilir; bir daha gösterilmez.';

-- Raporlama: her iki sözleşmeyi de kabul etmiş kullanıcılar (takip için)
CREATE OR REPLACE VIEW public.v_consent_accepted_users AS
SELECT
  p.id AS user_id,
  p.privacy_policy_accepted_at,
  p.terms_of_service_accepted_at,
  LEAST(p.privacy_policy_accepted_at, p.terms_of_service_accepted_at) AS first_consent_at
FROM public.profiles p
WHERE p.privacy_policy_accepted_at IS NOT NULL
  AND p.terms_of_service_accepted_at IS NOT NULL;

COMMENT ON VIEW public.v_consent_accepted_users IS 'Gizlilik ve kullanım şartlarını her ikisini de kabul etmiş kullanıcılar; takip ve raporlama için.';
