-- ÖNCE BU SQL'İ ÇALIŞTIRIN: Tabloları oluşturmak için
-- Supabase SQL Editor'den çalıştırın: https://supabase.com/dashboard/project/iuxnpxszfvyrdifchwvr/sql/new

-- Bu script Prisma migration yapmadan tabloları oluşturur
-- ÖNEMLİ: Prisma migration çalıştırmak daha iyi bir yöntemdir!

-- Tesis tablosu
CREATE TABLE IF NOT EXISTS "Tesis" (
    id TEXT PRIMARY KEY,
    "tesisAdi" TEXT NOT NULL,
    "yetkiliAdSoyad" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "il" TEXT NOT NULL,
    "ilce" TEXT NOT NULL,
    "adres" TEXT NOT NULL,
    "odaSayisi" INTEGER NOT NULL,
    "tesisTuru" TEXT NOT NULL,
    "vergiNo" TEXT,
    "unvan" TEXT,
    "web" TEXT,
    "instagram" TEXT,
    "not" TEXT,
    "kbsTuru" TEXT,
    "kbsTesisKodu" TEXT,
    "kbs_web_servis_sifre" TEXT,
    "ipKisitAktif" BOOLEAN DEFAULT false,
    "ipAdresleri" TEXT[] DEFAULT '{}',
    "tesisKodu" TEXT UNIQUE NOT NULL,
    "aktivasyonSifre" TEXT,
    "aktivasyonSifreExpiresAt" TIMESTAMP,
    "durum" TEXT DEFAULT 'incelemede',
    "paket" TEXT DEFAULT 'deneme',
    "kota" INTEGER DEFAULT 500,
    "kullanilanKota" INTEGER DEFAULT 0,
    "kotaResetTarihi" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Kullanici tablosu
CREATE TABLE IF NOT EXISTS "Kullanici" (
    id TEXT PRIMARY KEY,
    "tesisId" TEXT NOT NULL REFERENCES "Tesis"(id) ON DELETE CASCADE,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT,
    "pin" TEXT,
    "biyometriAktif" BOOLEAN DEFAULT false,
    "rol" TEXT DEFAULT 'resepsiyon',
    "checkInYetki" BOOLEAN DEFAULT true,
    "odaDegistirmeYetki" BOOLEAN DEFAULT true,
    "bilgiDuzenlemeYetki" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS "Kullanici_tesisId_idx" ON "Kullanici"("tesisId");

-- CUID fonksiyonu (basit versiyon)
CREATE OR REPLACE FUNCTION generate_cuid() RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    result := 'c';
    FOR i IN 1..24 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

