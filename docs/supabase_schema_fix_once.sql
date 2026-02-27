-- Supabase SQL Editor'da tek seferde çalıştır. (Oda, Misafir, Tesis, Kullanici, Siparis, branches — hepsi idempotent.)
-- Supabase Dashboard → SQL Editor → New query → yapıştır → Run.

-- ========== 1) Tesis ==========
ALTER TABLE "Tesis" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- ========== 2) Kullanici (giriş onayı + Ayarlar şifre) ==========
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisOnaylandi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisTalepAt" TIMESTAMP(3);
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "sifre" TEXT;

-- ========== 3) Siparis ==========
CREATE TABLE IF NOT EXISTS "Siparis" (
    "id" TEXT NOT NULL,
    "siparisNo" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "paket" TEXT NOT NULL,
    "tutarTL" INTEGER NOT NULL,
    "kredi" INTEGER NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'pending',
    "odemeAt" TIMESTAMP(3),
    "adminNot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Siparis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Siparis_siparisNo_key" ON "Siparis"("siparisNo");
CREATE INDEX IF NOT EXISTS "Siparis_tesisId_idx" ON "Siparis"("tesisId");
CREATE INDEX IF NOT EXISTS "Siparis_durum_idx" ON "Siparis"("durum");
CREATE INDEX IF NOT EXISTS "Siparis_createdAt_idx" ON "Siparis"("createdAt");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Siparis_tesisId_fkey') THEN
        ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_tesisId_fkey"
            FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ========== 4) Oda (Prisma ile aynı; yoksa oluştur) ==========
CREATE TABLE IF NOT EXISTS "Oda" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "odaNumarasi" TEXT NOT NULL,
    "odaTipi" TEXT NOT NULL,
    "kapasite" INTEGER NOT NULL,
    "fotograf" TEXT,
    "not" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bos',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Oda_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Oda_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Oda_tesisId_odaNumarasi_key" ON "Oda"("tesisId", "odaNumarasi");
CREATE INDEX IF NOT EXISTS "Oda_tesisId_idx" ON "Oda"("tesisId");

-- ========== 5) Misafir (Prisma ile aynı; yoksa oluştur) ==========
CREATE TABLE IF NOT EXISTS "Misafir" (
    "id" TEXT NOT NULL,
    "odaId" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "kimlikNo" TEXT NOT NULL,
    "pasaportNo" TEXT,
    "dogumTarihi" TIMESTAMP(3) NOT NULL,
    "uyruk" TEXT NOT NULL,
    "girisTarihi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cikisTarihi" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Misafir_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Misafir_odaId_fkey" FOREIGN KEY ("odaId") REFERENCES "Oda"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Misafir_tesisId_idx" ON "Misafir"("tesisId");
CREATE INDEX IF NOT EXISTS "Misafir_odaId_idx" ON "Misafir"("odaId");

-- ========== 6) branches (KBS onay — Ayarlar / auth) ==========
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.branches.kbs_approved IS 'KBS tesis bilgisi admin tarafından onaylandı mı';
COMMENT ON COLUMN public.branches.kbs_approved_at IS 'Son onay zamanı';
