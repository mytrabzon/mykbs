-- KYC / Kimlik doğrulama: oturum, belge özeti, tarama görselleri, çıkarılan alanlar.
-- PII: ham veri şifreli saklanır; belge no hash ile tutulur; loglarda tam değer basılmaz.
-- Saklama: ham görsel/NFC verisi X gün sonra silinebilir (örn 7–30 gün, policy ile).

-- Oturum: bir doğrulama akışı (başladı / bitti / başarısız)
CREATE TABLE IF NOT EXISTS public.verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'document_captured', 'confirmed', 'verified', 'rejected', 'expired')),
  document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'id', 'driver_license')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_sessions_user ON public.verification_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_status ON public.verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_branch ON public.verification_sessions(branch_id) WHERE branch_id IS NOT NULL;

-- Belge özeti (kritik değerler hash; plaintext belge no saklanmaz)
CREATE TABLE IF NOT EXISTS public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.verification_sessions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'id', 'driver_license')),
  issuing_country TEXT,
  document_number_hash TEXT NOT NULL,
  date_of_birth DATE,
  date_of_expiry DATE,
  date_of_issue DATE,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  mrz_present BOOLEAN NOT NULL DEFAULT false,
  nfc_present BOOLEAN NOT NULL DEFAULT false,
  face_image_present BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_documents_session ON public.verification_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_documents_expiry ON public.verification_documents(date_of_expiry);

-- Tarama görselleri (front/back/selfie) – path veya encrypted ref; gerçek dosya encrypted storage’da
CREATE TABLE IF NOT EXISTS public.verification_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.verification_sessions(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('front', 'back', 'selfie', 'nfc_face')),
  storage_path_enc TEXT,
  purge_after TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_scans_session ON public.verification_scans(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_scans_purge ON public.verification_scans(purge_after) WHERE purge_after IS NOT NULL;

-- Çıkarılan alanlar (MRZ / NFC / OCR) – source + normalize edilmiş JSON; ham MRZ/NFC şifreli
CREATE TABLE IF NOT EXISTS public.verification_extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.verification_sessions(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('mrz', 'nfc', 'ocr')),
  fields_json_enc TEXT,
  mrz_raw_enc TEXT,
  nfc_dg1_raw_enc TEXT,
  nfc_dg2_face_ref_enc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_extracted_session ON public.verification_extracted_fields(session_id);
CREATE INDEX IF NOT EXISTS idx_verification_extracted_source ON public.verification_extracted_fields(session_id, source);

-- RLS
ALTER TABLE public.verification_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_extracted_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS verification_sessions_user ON public.verification_sessions;
CREATE POLICY verification_sessions_user ON public.verification_sessions
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS verification_documents_via_session ON public.verification_documents;
CREATE POLICY verification_documents_via_session ON public.verification_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.verification_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS verification_scans_via_session ON public.verification_scans;
CREATE POLICY verification_scans_via_session ON public.verification_scans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.verification_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS verification_extracted_via_session ON public.verification_extracted_fields;
CREATE POLICY verification_extracted_via_session ON public.verification_extracted_fields
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.verification_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_verification_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS verification_sessions_updated_at ON public.verification_sessions;
CREATE TRIGGER verification_sessions_updated_at
  BEFORE UPDATE ON public.verification_sessions
  FOR EACH ROW EXECUTE PROCEDURE set_verification_sessions_updated_at();
