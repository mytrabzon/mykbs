-- =============================================================================
-- Yeni Kayıt Sistemi + Odalar – PostgreSQL Şema (son hali, idempotent)
-- Eksik kolonları ekler; Odalar (Oda) tablosu tam tanımlıdır.
-- Kullanım: Backend PostgreSQL'de (Supabase SQL Editor veya psql) çalıştırın.
-- Tam şema için: backend klasöründe `npx prisma migrate deploy` kullanın.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tesis – Eksik/yanlış kolonlar
-- -----------------------------------------------------------------------------
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "tesisAdi" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "yetkiliAdSoyad" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "telefon" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "il" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "ilce" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "adres" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "odaSayisi" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "tesisTuru" TEXT NOT NULL DEFAULT 'otel';
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "vergiNo" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "unvan" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "web" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "instagram" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "not" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "kbsTuru" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "kbsTesisKodu" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "kbs_web_servis_sifre" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "ipKisitAktif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "ipAdresleri" TEXT NOT NULL DEFAULT '';
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "tesisKodu" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "aktivasyonSifre" TEXT;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "aktivasyonSifreExpiresAt" TIMESTAMP(3);
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "durum" TEXT NOT NULL DEFAULT 'incelemede';
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "paket" TEXT NOT NULL DEFAULT 'deneme';
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "kota" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "kullanilanKota" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "kotaResetTarihi" TIMESTAMP(3);
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tesis_tesisKodu_key')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Tesis') THEN
    CREATE UNIQUE INDEX "Tesis_tesisKodu_key" ON public."Tesis"("tesisKodu");
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Kullanici – Eksik kolonlar
-- -----------------------------------------------------------------------------
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "tesisId" TEXT;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "adSoyad" TEXT;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "telefon" TEXT;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "sifre" TEXT;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "pin" TEXT;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "biyometriAktif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "rol" TEXT NOT NULL DEFAULT 'resepsiyon';
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "checkInYetki" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "odaDegistirmeYetki" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "bilgiDuzenlemeYetki" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "girisOnaylandi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "girisTalepAt" TIMESTAMP(3);
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Kullanici_tesisId_idx" ON public."Kullanici"("tesisId");
CREATE INDEX IF NOT EXISTS "Kullanici_email_idx" ON public."Kullanici"("email");
CREATE INDEX IF NOT EXISTS "Kullanici_telefon_idx" ON public."Kullanici"("telefon");

-- -----------------------------------------------------------------------------
-- 3) Oda (Odalar) – Tablo yoksa oluştur; varsa eksik kolonları ekle (son şema)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public."Oda" (
  "id" TEXT NOT NULL,
  "tesisId" TEXT NOT NULL,
  "odaNumarasi" TEXT NOT NULL,
  "odaTipi" TEXT NOT NULL,
  "kapasite" INTEGER NOT NULL,
  "fotograf" TEXT,
  "not" TEXT,
  "durum" TEXT NOT NULL DEFAULT 'bos',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id"),
  CONSTRAINT "Oda_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES public."Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Oda: Eksik kolonlar (tablo eski migration'dan varsa; id/tesisId zaten varsa eklenmez)
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "odaNumarasi" TEXT;
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "odaTipi" TEXT;
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "kapasite" INTEGER;
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "fotograf" TEXT;
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "not" TEXT;
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "durum" TEXT NOT NULL DEFAULT 'bos';
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public."Oda" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Oda: Tesis + oda numarası tekil (aynı tesiste aynı numara iki kez olmasın)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Oda_tesisId_odaNumarasi_key')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Oda') THEN
    CREATE UNIQUE INDEX "Oda_tesisId_odaNumarasi_key" ON public."Oda"("tesisId", "odaNumarasi");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Oda_tesisId_idx" ON public."Oda"("tesisId");

-- -----------------------------------------------------------------------------
-- 4) Yorumlar
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public."Tesis"."kota" IS 'Bildirim kotası (ortalama bildirim; kayıtta 50-10000 arası)';
COMMENT ON COLUMN public."Kullanici"."sifre" IS 'Bcrypt hash; e-posta/telefon + şifre girişi için';
COMMENT ON TABLE public."Oda" IS 'Tesis odaları; tesisId + odaNumarasi tekil. durum: bos | dolu';
