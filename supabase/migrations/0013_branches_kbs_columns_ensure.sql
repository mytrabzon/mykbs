-- branches tablosunda kbs_* sütunları yoksa ekle (400/42703 hatasını önler)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_turu') THEN
    ALTER TABLE public.branches ADD COLUMN kbs_turu TEXT CHECK (kbs_turu IS NULL OR kbs_turu IN ('polis', 'jandarma'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_tesis_kodu') THEN
    ALTER TABLE public.branches ADD COLUMN kbs_tesis_kodu TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_web_servis_sifre') THEN
    ALTER TABLE public.branches ADD COLUMN kbs_web_servis_sifre TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_configured') THEN
    ALTER TABLE public.branches ADD COLUMN kbs_configured BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_endpoint_url') THEN
    ALTER TABLE public.branches ADD COLUMN kbs_endpoint_url TEXT;
  END IF;
END $$;
