-- DEPRECATED: Çalıştırmayın. Eski şema (ipAdresleri TEXT[], trialEndsAt/Siparis vb. yok). Prisma migrate + docs/supabase_schema_fix_once.sql kullanın. Detay: docs/SQL_CAKISMA_VE_GEREKSIZ_RAPORU.md
-- TÜM TABLOLAR VE ADMIN KAYDI OLUŞTURMA SQL SCRIPTİ
-- Supabase SQL Editor'den çalıştırın: https://supabase.com/dashboard/project/iuxnpxszfvyrdifchwvr/sql/new
-- Bu script önce tüm tabloları oluşturur, sonra admin tesis ve kullanıcıyı ekler

-- ========================================
-- 1. CUID FONKSİYONU (ID oluşturmak için)
-- ========================================
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

-- ========================================
-- 2. TÜM TABLOLARI OLUŞTUR
-- ========================================

-- Tesis tablosu
CREATE TABLE IF NOT EXISTS "Tesis" (
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

-- Kullanici tablosu
CREATE TABLE IF NOT EXISTS "Kullanici" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
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

-- Oda tablosu
CREATE TABLE IF NOT EXISTS "Oda" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "tesisId" TEXT NOT NULL REFERENCES "Tesis"(id) ON DELETE CASCADE,
    "odaNumarasi" TEXT NOT NULL,
    "odaTipi" TEXT NOT NULL,
    "kapasite" INTEGER NOT NULL,
    "fotograf" TEXT,
    "not" TEXT,
    "durum" TEXT DEFAULT 'bos',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW(),
    UNIQUE("tesisId", "odaNumarasi")
);

-- Misafir tablosu
CREATE TABLE IF NOT EXISTS "Misafir" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "odaId" TEXT NOT NULL REFERENCES "Oda"(id) ON DELETE CASCADE,
    "tesisId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "kimlikNo" TEXT NOT NULL,
    "pasaportNo" TEXT,
    "dogumTarihi" TIMESTAMP NOT NULL,
    "uyruk" TEXT NOT NULL,
    "girisTarihi" TIMESTAMP DEFAULT NOW(),
    "cikisTarihi" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Bildirim tablosu
CREATE TABLE IF NOT EXISTS "Bildirim" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "tesisId" TEXT NOT NULL REFERENCES "Tesis"(id) ON DELETE CASCADE,
    "misafirId" TEXT NOT NULL REFERENCES "Misafir"(id) ON DELETE CASCADE,
    "durum" TEXT NOT NULL,
    "hataMesaji" TEXT,
    "denemeSayisi" INTEGER DEFAULT 0,
    "sonDenemeTarihi" TIMESTAMP,
    "kbsTuru" TEXT,
    "kbsYanit" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Log tablosu
CREATE TABLE IF NOT EXISTS "Log" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "tesisId" TEXT NOT NULL REFERENCES "Tesis"(id) ON DELETE CASCADE,
    "islem" TEXT NOT NULL,
    "detay" JSONB,
    "kullaniciId" TEXT,
    "basarili" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- Hata tablosu
CREATE TABLE IF NOT EXISTS "Hata" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "tesisId" TEXT NOT NULL REFERENCES "Tesis"(id) ON DELETE CASCADE,
    "bildirimId" TEXT,
    "hataTipi" TEXT NOT NULL,
    "hataMesaji" TEXT NOT NULL,
    "durum" TEXT DEFAULT 'acik',
    "cozumNotu" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- AuditLog tablosu
CREATE TABLE IF NOT EXISTS "AuditLog" (
    id TEXT PRIMARY KEY DEFAULT generate_cuid(),
    "tesisId" TEXT NOT NULL REFERENCES "Tesis"(id) ON DELETE CASCADE,
    "kullaniciId" TEXT,
    "islem" TEXT NOT NULL,
    "eskiDeger" JSONB,
    "yeniDeger" JSONB,
    "createdAt" TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- 3. INDEX'LER
-- ========================================
CREATE INDEX IF NOT EXISTS "Kullanici_tesisId_idx" ON "Kullanici"("tesisId");
CREATE INDEX IF NOT EXISTS "Oda_tesisId_idx" ON "Oda"("tesisId");
CREATE INDEX IF NOT EXISTS "Misafir_tesisId_idx" ON "Misafir"("tesisId");
CREATE INDEX IF NOT EXISTS "Misafir_odaId_idx" ON "Misafir"("odaId");
CREATE INDEX IF NOT EXISTS "Bildirim_tesisId_idx" ON "Bildirim"("tesisId");
CREATE INDEX IF NOT EXISTS "Bildirim_misafirId_idx" ON "Bildirim"("misafirId");
CREATE INDEX IF NOT EXISTS "Bildirim_durum_idx" ON "Bildirim"("durum");
CREATE INDEX IF NOT EXISTS "Log_tesisId_idx" ON "Log"("tesisId");
CREATE INDEX IF NOT EXISTS "Log_createdAt_idx" ON "Log"("createdAt");
CREATE INDEX IF NOT EXISTS "Hata_tesisId_idx" ON "Hata"("tesisId");
CREATE INDEX IF NOT EXISTS "Hata_durum_idx" ON "Hata"("durum");
CREATE INDEX IF NOT EXISTS "AuditLog_tesisId_idx" ON "AuditLog"("tesisId");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ========================================
-- 4. ADMIN TESİS VE KULLANICI OLUŞTUR
-- ========================================
DO $$
DECLARE
    v_tesis_id TEXT;
    v_kullanici_id TEXT;
    v_hashed_pin TEXT := '$2a$10$ySfuI9BMVS6tHG9DxedfwuBnAlFDrbLL0GB2BLXvlzEV3U36YuwCS'; -- PIN: 611633
BEGIN
    
    -- Tesis var mı kontrol et
    SELECT id INTO v_tesis_id 
    FROM "Tesis" 
    WHERE "tesisKodu" = '1';
    
    IF v_tesis_id IS NULL THEN
        -- Yeni tesis ID oluştur
        v_tesis_id := generate_cuid();
        
        -- Yeni tesis oluştur
        INSERT INTO "Tesis" (
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
        UPDATE "Tesis"
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
    FROM "Kullanici"
    WHERE "tesisId" = v_tesis_id 
    AND "telefon" = '5330483061';
    
    IF v_kullanici_id IS NULL THEN
        -- Yeni kullanıcı ID oluştur
        v_kullanici_id := generate_cuid();
        
        -- Yeni kullanıcı oluştur
        INSERT INTO "Kullanici" (
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
        UPDATE "Kullanici"
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
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE '✅ İŞLEM TAMAMLANDI!';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
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
    RAISE NOTICE '✅ Tüm tablolar oluşturuldu!';
    RAISE NOTICE '✅ Admin hesabı hazır!';
    RAISE NOTICE '';
    
END $$;

