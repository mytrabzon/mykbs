-- AlterTable: Tesis kodu + PIN girişi admin onayı (gri/yeşil gösterge)
ALTER TABLE "Kullanici" ADD COLUMN "girisOnaylandi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Kullanici" ADD COLUMN "girisTalepAt" TIMESTAMP(3);

-- Mevcut kullanıcılar onaylı kabul edilir (geriye dönük uyumluluk)
UPDATE "Kullanici" SET "girisOnaylandi" = true;
