-- Idempotent: Tablolar/indeksler/constraint'ler zaten varsa hata vermez (IF NOT EXISTS / EXCEPTION).

-- HotelStaff
CREATE TABLE IF NOT EXISTS "HotelStaff" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "canViewPhotos" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelStaff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HotelStaff_tesisId_kullaniciId_key" ON "HotelStaff"("tesisId", "kullaniciId");
CREATE INDEX IF NOT EXISTS "HotelStaff_tesisId_idx" ON "HotelStaff"("tesisId");
CREATE INDEX IF NOT EXISTS "HotelStaff_kullaniciId_idx" ON "HotelStaff"("kullaniciId");
DO $$ BEGIN
    ALTER TABLE "HotelStaff" ADD CONSTRAINT "HotelStaff_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "HotelStaff" ADD CONSTRAINT "HotelStaff_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Guest
CREATE TABLE IF NOT EXISTS "Guest" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "displayName" TEXT,
    "photoUrl" TEXT,
    "photoBlurhash" TEXT,
    "identityHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Guest_tesisId_idx" ON "Guest"("tesisId");
CREATE INDEX IF NOT EXISTS "Guest_expiresAt_idx" ON "Guest"("expiresAt");
CREATE INDEX IF NOT EXISTS "Guest_identityHash_tesisId_idx" ON "Guest"("identityHash", "tesisId");
DO $$ BEGIN
    ALTER TABLE "Guest" ADD CONSTRAINT "Guest_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Stay
CREATE TABLE IF NOT EXISTS "Stay" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "guestId" TEXT,
    "odaId" TEXT,
    "roomNo" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),
    "usageType" TEXT NOT NULL,
    "kbsStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kbsLastError" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Stay_tesisId_idx" ON "Stay"("tesisId");
CREATE INDEX IF NOT EXISTS "Stay_guestId_idx" ON "Stay"("guestId");
CREATE INDEX IF NOT EXISTS "Stay_odaId_idx" ON "Stay"("odaId");
CREATE INDEX IF NOT EXISTS "Stay_checkInAt_idx" ON "Stay"("checkInAt");
CREATE INDEX IF NOT EXISTS "Stay_expiresAt_idx" ON "Stay"("expiresAt");
DO $$ BEGIN
    ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Stay" ADD CONSTRAINT "Stay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "Stay" ADD CONSTRAINT "Stay_odaId_fkey" FOREIGN KEY ("odaId") REFERENCES "Oda"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- KbsSubmission
CREATE TABLE IF NOT EXISTS "KbsSubmission" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "citizenshipType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseCode" TEXT,
    "responseMessage" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KbsSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "KbsSubmission_tesisId_idx" ON "KbsSubmission"("tesisId");
CREATE INDEX IF NOT EXISTS "KbsSubmission_stayId_idx" ON "KbsSubmission"("stayId");
CREATE INDEX IF NOT EXISTS "KbsSubmission_sentAt_idx" ON "KbsSubmission"("sentAt");
CREATE INDEX IF NOT EXISTS "KbsSubmission_correlationId_idx" ON "KbsSubmission"("correlationId");
DO $$ BEGIN
    ALTER TABLE "KbsSubmission" ADD CONSTRAINT "KbsSubmission_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "KbsSubmission" ADD CONSTRAINT "KbsSubmission_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
