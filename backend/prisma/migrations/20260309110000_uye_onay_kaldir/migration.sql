-- Üye onayı kaldırıldı: yeni kayıtlar onaysız giriş yapabilsin, mevcut bekleyenler de onaylı sayılsın.
ALTER TABLE "Kullanici" ALTER COLUMN "girisOnaylandi" SET DEFAULT true;
UPDATE "Kullanici" SET "girisOnaylandi" = true WHERE "girisOnaylandi" = false;
