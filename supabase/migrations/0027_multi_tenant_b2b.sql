-- KBS Prime B2B Multi-Tenant: tenants + tenant_kullanicilar, mevcut tablolara tenant_id
-- UUID extension (gen_random_uuid) zaten mevcut

-- 1. Tenants tablosu (B2B müşteri otel)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  otel_adi TEXT NOT NULL,
  yetkili_adi TEXT,
  yetkili_telefon TEXT,
  yetkili_email TEXT UNIQUE,
  vergi_no TEXT,
  adres TEXT,
  paket_tipi TEXT DEFAULT 'bronze' CHECK (paket_tipi IN ('gold', 'silver', 'bronze', 'trial')),
  lisans_baslangic DATE,
  lisans_bitis DATE,
  oda_sayisi INTEGER DEFAULT 0,
  kullanici_sayisi INTEGER DEFAULT 1,
  ayarlar JSONB DEFAULT '{}',
  durum TEXT DEFAULT 'aktif' CHECK (durum IN ('aktif', 'pasif', 'deneme')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_durum ON public.tenants(durum);
CREATE INDEX IF NOT EXISTS idx_tenants_yetkili_email ON public.tenants(yetkili_email) WHERE yetkili_email IS NOT NULL;

-- 2. Tenant kullanıcıları (merkez panel veya otel paneli girişi için)
CREATE TABLE IF NOT EXISTS public.tenant_kullanicilar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  sifre_hash TEXT,
  ad_soyad TEXT,
  rol TEXT DEFAULT 'yonetici' CHECK (rol IN ('yonetici', 'personel', 'temizlik')),
  yetkiler JSONB DEFAULT '{}',
  son_giris TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_tenant_kullanicilar_tenant ON public.tenant_kullanicilar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_kullanicilar_email ON public.tenant_kullanicilar(email);

-- 3. verification_sessions ve verification_documents'a tenant_id ekle
ALTER TABLE public.verification_sessions
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.verification_documents
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_verification_sessions_tenant ON public.verification_sessions(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_verification_documents_tenant ON public.verification_documents(tenant_id) WHERE tenant_id IS NOT NULL;

-- RLS: tenants ve tenant_kullanicilar için (merkez admin tümünü görür; tenant kullanıcı sadece kendi tenant'ını)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_kullanicilar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_select_all ON public.tenants;
CREATE POLICY tenants_select_all ON public.tenants FOR SELECT USING (true);

DROP POLICY IF EXISTS tenant_kullanicilar_own_tenant ON public.tenant_kullanicilar;
CREATE POLICY tenant_kullanicilar_own_tenant ON public.tenant_kullanicilar
  FOR ALL USING (true);

-- updated_at trigger for tenants (mevcut set_updated_at kullan)
DROP TRIGGER IF EXISTS tenants_updated_at ON public.tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
