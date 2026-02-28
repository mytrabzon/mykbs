-- AlterTable: Misafir - 2. ad ve Jandarma/Polis misafir tipi (TC vatandaşı / YKN / Yabancı)
ALTER TABLE "Misafir" ADD COLUMN "ad2" TEXT;
ALTER TABLE "Misafir" ADD COLUMN "misafirTipi" TEXT;
ALTER TABLE "Misafir" ALTER COLUMN "kimlikNo" DROP NOT NULL;
