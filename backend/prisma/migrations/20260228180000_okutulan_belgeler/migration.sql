-- CreateTable
CREATE TABLE "OkutulanBelge" (
    "id" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "belgeTuru" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "kimlikNo" TEXT,
    "pasaportNo" TEXT,
    "belgeNo" TEXT,
    "dogumTarihi" TEXT,
    "uyruk" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OkutulanBelge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OkutulanBelge_tesisId_idx" ON "OkutulanBelge"("tesisId");

-- CreateIndex
CREATE INDEX "OkutulanBelge_createdAt_idx" ON "OkutulanBelge"("createdAt");

-- AddForeignKey
ALTER TABLE "OkutulanBelge" ADD CONSTRAINT "OkutulanBelge_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
