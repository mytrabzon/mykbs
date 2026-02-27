-- Prisma migration'larını Supabase SQL Editor'da tek seferde uygula (idempotent).
-- Supabase Dashboard → SQL Editor → New query → yapıştır → Run.
--
-- Bölüm 4 (_prisma_migrations INSERT): Prisma sürümüne göre sütun isimleri farklı olabilir.
-- Hata alırsanız Table Editor → _prisma_migrations ile sütunları kontrol edin veya 4. bölümü silip sadece 1–3'ü çalıştırın.

-- 1) Tesis: trialEndsAt
ALTER TABLE "Tesis" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- 2) Kullanici: giris onayı
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisOnaylandi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisTalepAt" TIMESTAMP(3);
UPDATE "Kullanici" SET "girisOnaylandi" = true WHERE "girisOnaylandi" = false;

-- 3) Siparis tablosu (yoksa oluştur)
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
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Siparis_tesisId_fkey'
    ) THEN
        ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_tesisId_fkey"
            FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4) Prisma migration tablosu (yoksa oluştur) ve kayıtlar
-- Prisma bu tabloyu hiç oluşturmamışsa (örn. şema Supabase/manuel uygulandıysa) önce tabloyu ekliyoruz.
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, 'b0c8ee5fdfefbaccd7a90288d94a16a92cfcf66bb7aefd54c585a70dfbf1739c', now(), '20260123170742_init', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260123170742_init');
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '171cb6832b45090a39952658f5cd2148b7cb24408517dd637ad770f3ccc38c55', now(), '20260227000000_giris_onay', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260227000000_giris_onay');
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '9c61ccd1c2eda695a260f0007ef1d956366091dfdf3e2fca409d5f67f8b78b77', now(), '20260227120000_trial_and_packages', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260227120000_trial_and_packages');
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
SELECT gen_random_uuid()::text, '460446d2d75285d46e25e2a807a27b4c0855f3cd54a08d23e6b76d298786d42d', now(), '20260227150000_siparis_tablosu', NULL, NULL, now(), 1
WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '20260227150000_siparis_tablosu');
