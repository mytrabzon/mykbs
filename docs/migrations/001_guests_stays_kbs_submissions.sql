-- YEDEK / Prisma kullanılmıyorsa: Bu SQL ile aynı tabloları elle oluşturabilirsiniz.
-- Önerilen yol: backend'de Prisma kullanılıyor → backend/prisma/migrations/20260228150000_guests_stays_kbs_submissions/migration.sql
-- çalıştırmak için: cd backend && npx prisma migrate deploy
--
-- Hedef tablolar: Guest, Stay, KbsSubmission, HotelStaff.
-- Çalıştırma (elle): Supabase SQL Editor veya psql $DATABASE_URL -f 001_guests_stays_kbs_submissions.sql
-- Geri al: 001_guests_stays_kbs_submissions_ROLLBACK.sql
-- Not: PostgreSQL 13+ (gen_random_uuid()). Eski sürüm: CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1) HotelStaff: Tesis–Kullanıcı eşleşmesi, rol ve foto görüntüleme yetkisi
CREATE TABLE IF NOT EXISTS "HotelStaff" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tesisId"      TEXT NOT NULL REFERENCES "Tesis"("id") ON DELETE CASCADE,
  "kullaniciId"  TEXT NOT NULL REFERENCES "Kullanici"("id") ON DELETE CASCADE,
  "role"         TEXT NOT NULL DEFAULT 'staff' CHECK ("role" IN ('owner', 'manager', 'staff')),
  "canViewPhotos" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("tesisId", "kullaniciId")
);

CREATE INDEX IF NOT EXISTS "HotelStaff_tesisId_idx" ON "HotelStaff"("tesisId");
CREATE INDEX IF NOT EXISTS "HotelStaff_kullaniciId_idx" ON "HotelStaff"("kullaniciId");

-- 2) Guest: Otel içi profil (foto + identity_hash; belge numarası saklanmaz), 30 gün sonra silinecek
CREATE TABLE IF NOT EXISTS "Guest" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tesisId"        TEXT NOT NULL REFERENCES "Tesis"("id") ON DELETE CASCADE,
  "displayName"    TEXT,
  "photoUrl"       TEXT,
  "photoBlurhash"  TEXT,
  "identityHash"    TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "Guest_tesisId_idx" ON "Guest"("tesisId");
CREATE INDEX IF NOT EXISTS "Guest_expiresAt_idx" ON "Guest"("expiresAt");
CREATE INDEX IF NOT EXISTS "Guest_identityHash_tesisId_idx" ON "Guest"("identityHash", "tesisId");

-- 3) Stay: Konaklama kaydı (guest nullable; MRZ okunmadıysa geçici stay)
CREATE TABLE IF NOT EXISTS "Stay" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tesisId"      TEXT NOT NULL REFERENCES "Tesis"("id") ON DELETE CASCADE,
  "guestId"      TEXT REFERENCES "Guest"("id") ON DELETE SET NULL,
  "odaId"        TEXT REFERENCES "Oda"("id") ON DELETE SET NULL,
  "roomNo"       TEXT NOT NULL,
  "checkInAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkOutAt"   TIMESTAMP(3),
  "usageType"    TEXT NOT NULL CHECK ("usageType" IN ('konaklama', 'gunici', 'depremzede')),
  "kbsStatus"    TEXT NOT NULL DEFAULT 'PENDING' CHECK ("kbsStatus" IN ('PENDING', 'SENT', 'ACCEPTED', 'REJECTED')),
  "kbsLastError" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"    TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "Stay_tesisId_idx" ON "Stay"("tesisId");
CREATE INDEX IF NOT EXISTS "Stay_guestId_idx" ON "Stay"("guestId");
CREATE INDEX IF NOT EXISTS "Stay_odaId_idx" ON "Stay"("odaId");
CREATE INDEX IF NOT EXISTS "Stay_checkInAt_idx" ON "Stay"("checkInAt");
CREATE INDEX IF NOT EXISTS "Stay_expiresAt_idx" ON "Stay"("expiresAt");

-- 4) KbsSubmission: KBS'ye gönderilen payload (audit), PII minimize
CREATE TABLE IF NOT EXISTS "KbsSubmission" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tesisId"          TEXT NOT NULL REFERENCES "Tesis"("id") ON DELETE CASCADE,
  "stayId"           TEXT NOT NULL REFERENCES "Stay"("id") ON DELETE CASCADE,
  "citizenshipType"  TEXT NOT NULL CHECK ("citizenshipType" IN ('TC', 'YKN', 'FOREIGN')),
  "payloadJson"      JSONB NOT NULL,
  "sentAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responseCode"     TEXT,
  "responseMessage"  TEXT,
  "correlationId"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "KbsSubmission_tesisId_idx" ON "KbsSubmission"("tesisId");
CREATE INDEX IF NOT EXISTS "KbsSubmission_stayId_idx" ON "KbsSubmission"("stayId");
CREATE INDEX IF NOT EXISTS "KbsSubmission_sentAt_idx" ON "KbsSubmission"("sentAt");
CREATE INDEX IF NOT EXISTS "KbsSubmission_correlationId_idx" ON "KbsSubmission"("correlationId");

-- Opsiyonel: Mevcut Kullanici'yi her tesis için HotelStaff'a doldurmak (ilk çalıştırmada)
-- INSERT INTO "HotelStaff" ("id", "tesisId", "kullaniciId", "role", "canViewPhotos")
-- SELECT gen_random_uuid()::text, "tesisId", "id", CASE WHEN "rol" = 'sahip' THEN 'owner' WHEN "rol" = 'yonetici' THEN 'manager' ELSE 'staff' END, true
-- FROM "Kullanici"
-- ON CONFLICT ("tesisId", "kullaniciId") DO NOTHING;
