-- AlterTable
ALTER TABLE "Misafir" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Misafir_email_idx" ON "Misafir"("email");
