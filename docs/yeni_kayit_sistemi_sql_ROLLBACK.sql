-- =============================================================================
-- Yeni Kayıt Sistemi + Odalar – TERS (Rollback) – PostgreSQL
-- yeni_kayit_sistemi_sql.sql ile eklenen kolonları ve Oda tablosunu geri alır.
-- UYARI: Bu script veri siler (kolonlar ve Oda tablosu kaldırılır). Yedek alın.
-- Kullanım: Backend PostgreSQL'de (Supabase SQL Editor veya psql) çalıştırın.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Yorumları kaldır (kolon varsa; idempotent)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Tesis' AND column_name = 'kota') THEN
    EXECUTE 'COMMENT ON COLUMN public."Tesis"."kota" IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Kullanici' AND column_name = 'sifre') THEN
    EXECUTE 'COMMENT ON COLUMN public."Kullanici"."sifre" IS NULL';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Oda – Tabloyu kaldır (Misafir.odaId FK CASCADE ile kaldırılır)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public."Oda" CASCADE;

-- -----------------------------------------------------------------------------
-- 3) Kullanici – İndeksleri ve eklenen kolonları kaldır
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS public."Kullanici_telefon_idx";
DROP INDEX IF EXISTS public."Kullanici_email_idx";
DROP INDEX IF EXISTS public."Kullanici_tesisId_idx";

ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "girisTalepAt";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "girisOnaylandi";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "bilgiDuzenlemeYetki";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "odaDegistirmeYetki";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "checkInYetki";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "rol";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "biyometriAktif";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "pin";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "sifre";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "email";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "telefon";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "adSoyad";
ALTER TABLE public."Kullanici" DROP COLUMN IF EXISTS "tesisId";

-- -----------------------------------------------------------------------------
-- 4) Tesis – Unique constraint (veya indeks) ve eklenen kolonları kaldır
-- -----------------------------------------------------------------------------
-- CONSTRAINT olarak tanımlıysa DROP CONSTRAINT gerekir (indeks constraint'e bağlıdır)
ALTER TABLE public."Tesis" DROP CONSTRAINT IF EXISTS "Tesis_tesisKodu_key";
DROP INDEX IF EXISTS public."Tesis_tesisKodu_key";

ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "trialEndsAt";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "kotaResetTarihi";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "kullanilanKota";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "kota";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "paket";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "durum";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "aktivasyonSifreExpiresAt";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "aktivasyonSifre";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "tesisKodu";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "ipAdresleri";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "ipKisitAktif";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "kbs_web_servis_sifre";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "kbsTesisKodu";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "kbsTuru";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "not";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "instagram";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "web";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "unvan";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "vergiNo";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "tesisTuru";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "odaSayisi";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "adres";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "ilce";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "il";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "email";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "telefon";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "yetkiliAdSoyad";
ALTER TABLE public."Tesis" DROP COLUMN IF EXISTS "tesisAdi";

