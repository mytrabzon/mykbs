-- Hesap silme talebi: Prisma Kullanici için (7 gün içinde kalıcı silinir).
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "deletion_requested_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Kullanici_deletion_requested_at_idx" ON "Kullanici"("deletion_requested_at");
