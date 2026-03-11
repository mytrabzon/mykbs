-- Maliye raporları: guests.checkin_at (giriş tarihi), branches.oda_sayisi ve vergi_no
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS checkin_at TIMESTAMPTZ;
-- Mevcut kayıtlar için created_at = checkin_at
UPDATE public.guests SET checkin_at = created_at WHERE checkin_at IS NULL AND created_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_checkin_at ON public.guests(branch_id, checkin_at DESC);

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS oda_sayisi INTEGER DEFAULT 0;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS vergi_no TEXT;
COMMENT ON COLUMN public.branches.oda_sayisi IS 'Maliye raporu: toplam oda sayısı';
COMMENT ON COLUMN public.branches.vergi_no IS 'Maliye raporu: vergi numarası';
