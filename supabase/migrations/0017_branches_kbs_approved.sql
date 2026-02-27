-- branches: admin onayı sonrası KBS aktif (audit + hızlı kontrol için)
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.branches.kbs_approved IS 'KBS tesis bilgisi admin tarafından onaylandı mı';
COMMENT ON COLUMN public.branches.kbs_approved_at IS 'Son onay zamanı (facility_credentials_requests.reviewed_at ile senkron)';
