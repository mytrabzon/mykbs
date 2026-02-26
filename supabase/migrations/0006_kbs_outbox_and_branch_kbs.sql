-- KBS outbox (backend worker) + branch KBS ayarları + guests room/checkout
-- Otel sahipleri ayarlardan tesis kodu/şifre girecek; backend KBS'ye iletecek.

-- 1) branches: KBS türü, tesis kodu, web servis şifresi
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_turu') THEN
    ALTER TABLE branches ADD COLUMN kbs_turu TEXT CHECK (kbs_turu IS NULL OR kbs_turu IN ('polis', 'jandarma'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_tesis_kodu') THEN
    ALTER TABLE branches ADD COLUMN kbs_tesis_kodu TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_web_servis_sifre') THEN
    ALTER TABLE branches ADD COLUMN kbs_web_servis_sifre TEXT;
  END IF;
END $$;

-- 2) guests: oda numarası (KBS bildirimi için), çıkış tarihi
ALTER TABLE guests ADD COLUMN IF NOT EXISTS room_number TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS checkout_at TIMESTAMPTZ;

-- 3) KBS outbox: backend worker pending kayıtları işleyecek
CREATE TABLE IF NOT EXISTS public.kbs_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('checkin','checkout','room_change')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  try_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_try_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kbs_outbox_pending_idx
ON public.kbs_outbox (status, next_try_at);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kbs_outbox_updated ON public.kbs_outbox;
CREATE TRIGGER trg_kbs_outbox_updated
BEFORE UPDATE ON public.kbs_outbox
FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- branches: KBS ayarlarını güncellemek için (Ayarlar ekranı)
DROP POLICY IF EXISTS "branches_update_own" ON branches;
CREATE POLICY "branches_update_own"
  ON branches FOR UPDATE
  USING (id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid()))
  WITH CHECK (id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid()));

-- RLS: backend service_role ile yazacak; anon için select/insert gerekmez (backend kullanacak)
ALTER TABLE kbs_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kbs_outbox_service" ON kbs_outbox;
CREATE POLICY "kbs_outbox_service"
  ON kbs_outbox FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.kbs_outbox IS 'KBS bildirim kuyruğu; backend worker pending kayıtları Polis/Jandarma API''ye gönderir.';
