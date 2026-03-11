-- AlterTable: OkutulanBelge - oda no ve bildirildi (KBS bildirimi takibi)
ALTER TABLE "OkutulanBelge" ADD COLUMN IF NOT EXISTS "oda_no" TEXT;
ALTER TABLE "OkutulanBelge" ADD COLUMN IF NOT EXISTS "bildirildi" BOOLEAN DEFAULT false;
