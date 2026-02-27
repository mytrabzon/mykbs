-- AlterTable: Tesis kodu + PIN girişi admin onayı (gri/yeşil gösterge)
-- SQLite uyumlu (BOOLEAN=0/1, DATETIME)
ALTER TABLE "Kullanici" ADD COLUMN "girisOnaylandi" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Kullanici" ADD COLUMN "girisTalepAt" DATETIME;

-- Mevcut kullanıcılar onaylı kabul edilir (geriye dönük uyumluluk)
UPDATE "Kullanici" SET "girisOnaylandi" = 1;
