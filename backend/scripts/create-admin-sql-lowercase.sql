-- DEPRECATED: Bu scripti ÇALIŞTIRMAYIN. tesis/kullanici (küçük harf) oluşturur; Prisma "Tesis"/"Kullanici" kullanır. ipAdresleri TEXT[] Prisma ile uyumsuz. Detay: docs/SQL_CAKISMA_VE_GEREKSIZ_RAPORU.md
-- Admin Tesis Oluşturma SQL Scripti (Küçük harf tablo isimleri)
-- Supabase SQL Editor'den çalıştırın: https://supabase.com/dashboard/project/iuxnpxszfvyrdifchwvr/sql/new
-- Prisma genellikle tablo isimlerini küçük harfle oluşturur
-- Bu script önce tabloları kontrol eder, yoksa oluşturur, sonra admin kaydını ekler

-- ÖNCE TABLOLARI KONTROL ET VE OLUŞTUR
-- CUID fonksiyonu
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

-- Tesis tablosu (eğer yoksa) - küçük harf
CREATE TABLE IF NOT EXISTS tesis (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
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

-- Kullanici tablosu (eğer yoksa) - küçük harf
CREATE TABLE IF NOT EXISTS kullanici (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "tesisId" TEXT NOT NULL REFERENCES tesis(id) ON DELETE CASCADE,
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

-- Index (eğer yoksa)
CREATE INDEX IF NOT EXISTS "Kullanici_tesisId_idx" ON kullanici("tesisId");

-- ŞİMDİ ADMIN TESİS VE KULLANICI OLUŞTUR
DO $$
DECLARE
    v_tesis_id TEXT;
    v_kullanici_id TEXT;
    v_hashed_pin TEXT := '$2a$10$ySfuI9BMVS6tHG9DxedfwuBnAlFDrbLL0GB2BLXvlzEV3U36YuwCS'; -- PIN: 611633
BEGIN
    
    -- Tesis var mı kontrol et (küçük harf)
    SELECT id INTO v_tesis_id 
    FROM tesis 
    WHERE "tesisKodu" = '1';
    
    IF v_tesis_id IS NULL THEN
        -- Yeni tesis ID oluştur
        v_tesis_id := generate_cuid();
        
        -- Yeni tesis oluştur
        INSERT INTO tesis (
            id,
            "tesisKodu",
            "tesisAdi",
            "yetkiliAdSoyad",
            "telefon",
            "email",
            "il",
            "ilce",
            "adres",
            "odaSayisi",
            "tesisTuru",
            "durum",
            "paket",
            "kota",
            "createdAt",
            "updatedAt"
        ) VALUES (
            v_tesis_id,
            '1',
            'Admin Tesis',
            'Admin Kullanıcı',
            '5330483061',
            'admin@mykbs.com',
            'İstanbul',
            'Kadıköy',
            'Admin Adresi',
            10,
            'otel',
            'aktif',
            'pro',
            10000,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ Tesis oluşturuldu: %', v_tesis_id;
    ELSE
        -- Tesis mevcut, güncelle
        UPDATE tesis
        SET 
            "durum" = 'aktif',
            "paket" = 'pro',
            "kota" = 10000,
            "updatedAt" = NOW()
        WHERE id = v_tesis_id;
        
        RAISE NOTICE '✅ Tesis güncellendi: %', v_tesis_id;
    END IF;
    
    -- Kullanıcı var mı kontrol et
    SELECT id INTO v_kullanici_id
    FROM kullanici
    WHERE "tesisId" = v_tesis_id 
    AND "telefon" = '5330483061';
    
    IF v_kullanici_id IS NULL THEN
        -- Yeni kullanıcı ID oluştur
        v_kullanici_id := generate_cuid();
        
        -- Yeni kullanıcı oluştur
        INSERT INTO kullanici (
            id,
            "tesisId",
            "adSoyad",
            "telefon",
            "email",
            "pin",
            "rol",
            "checkInYetki",
            "odaDegistirmeYetki",
            "bilgiDuzenlemeYetki",
            "createdAt",
            "updatedAt"
        ) VALUES (
            v_kullanici_id,
            v_tesis_id,
            'Admin Kullanıcı',
            '5330483061',
            'admin@mykbs.com',
            v_hashed_pin,
            'sahip',
            true,
            true,
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ Kullanıcı oluşturuldu: %', v_kullanici_id;
    ELSE
        -- Kullanıcı mevcut, admin yap ve PIN güncelle
        UPDATE kullanici
        SET 
            "rol" = 'sahip',
            "pin" = v_hashed_pin,
            "checkInYetki" = true,
            "odaDegistirmeYetki" = true,
            "bilgiDuzenlemeYetki" = true,
            "updatedAt" = NOW()
        WHERE id = v_kullanici_id;
        
        RAISE NOTICE '✅ Kullanıcı admin yapıldı: %', v_kullanici_id;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '✅ İŞLEM TAMAMLANDI!';
    RAISE NOTICE '════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Giriş Bilgileri:';
    RAISE NOTICE '   Tesis Kodu: 1';
    RAISE NOTICE '   Telefon: 5330483061';
    RAISE NOTICE '   PIN: 611633';
    RAISE NOTICE '   Rol: sahip (Admin)';
    RAISE NOTICE '   Durum: aktif';
    RAISE NOTICE '   Paket: pro';
    RAISE NOTICE '   Kota: 10000';
    RAISE NOTICE '';
    
END $$;

