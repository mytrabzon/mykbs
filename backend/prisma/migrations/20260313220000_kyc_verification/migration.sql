-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "passportLast4" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "issuingCountry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycVerification_userId_idx" ON "KycVerification"("userId");

-- CreateIndex
CREATE INDEX "KycVerification_status_idx" ON "KycVerification"("status");

-- CreateIndex
CREATE INDEX "KycVerification_createdAt_idx" ON "KycVerification"("createdAt");
