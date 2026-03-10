-- CreateTable: B2B Multi-Tenant (tenants) — Supabase ile uyumlu UUID id (IF NOT EXISTS idempotent)
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "otel_adi" TEXT NOT NULL,
    "yetkili_adi" TEXT,
    "yetkili_telefon" TEXT,
    "yetkili_email" TEXT,
    "vergi_no" TEXT,
    "adres" TEXT,
    "paket_tipi" TEXT NOT NULL DEFAULT 'bronze',
    "lisans_baslangic" TIMESTAMP(3),
    "lisans_bitis" TIMESTAMP(3),
    "oda_sayisi" INTEGER NOT NULL DEFAULT 0,
    "kullanici_sayisi" INTEGER NOT NULL DEFAULT 1,
    "ayarlar" JSONB NOT NULL DEFAULT '{}',
    "durum" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_yetkili_email_key" ON "tenants"("yetkili_email");

-- tenants tablosu Supabase'de UUID id ile mevcut; Tesis.tenant_id UUID olmalı
-- Eğer önceki denemede TEXT eklendiyse kaldırıp UUID ile ekliyoruz
ALTER TABLE "Tesis" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "Tesis" ADD COLUMN "tenant_id" UUID REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- OkutulanBelge.tenant_id: Supabase tenants(id) UUID ile uyumlu (raporlama için)
ALTER TABLE "OkutulanBelge" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "OkutulanBelge" ADD COLUMN "tenant_id" UUID;

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "Tesis_tenant_id_idx" ON "Tesis"("tenant_id");
CREATE INDEX IF NOT EXISTS "OkutulanBelge_tenantId_idx" ON "OkutulanBelge"("tenant_id");
