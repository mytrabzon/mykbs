-- CreateTable: Paket siparişleri (mobil Satın Al + admin satış takibi)
CREATE TABLE "Siparis" (
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

CREATE UNIQUE INDEX "Siparis_siparisNo_key" ON "Siparis"("siparisNo");
CREATE INDEX "Siparis_tesisId_idx" ON "Siparis"("tesisId");
CREATE INDEX "Siparis_durum_idx" ON "Siparis"("durum");
CREATE INDEX "Siparis_createdAt_idx" ON "Siparis"("createdAt");

ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
