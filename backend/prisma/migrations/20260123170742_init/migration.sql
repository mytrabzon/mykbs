-- CreateTable
CREATE TABLE "Tesis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisAdi" TEXT NOT NULL,
    "yetkiliAdSoyad" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "il" TEXT NOT NULL,
    "ilce" TEXT NOT NULL,
    "adres" TEXT NOT NULL,
    "odaSayisi" INTEGER NOT NULL,
    "tesisTuru" TEXT NOT NULL,
    "vergiNo" TEXT,
    "unvan" TEXT,
    "web" TEXT,
    "instagram" TEXT,
    "not" TEXT,
    "kbsTuru" TEXT,
    "kbsTesisKodu" TEXT,
    "kbs_web_servis_sifre" TEXT,
    "ipKisitAktif" BOOLEAN NOT NULL DEFAULT false,
    "ipAdresleri" TEXT NOT NULL DEFAULT '',
    "tesisKodu" TEXT NOT NULL,
    "aktivasyonSifre" TEXT,
    "aktivasyonSifreExpiresAt" DATETIME,
    "durum" TEXT NOT NULL DEFAULT 'incelemede',
    "paket" TEXT NOT NULL DEFAULT 'deneme',
    "kota" INTEGER NOT NULL DEFAULT 500,
    "kullanilanKota" INTEGER NOT NULL DEFAULT 0,
    "kotaResetTarihi" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisId" TEXT NOT NULL,
    "adSoyad" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "email" TEXT,
    "sifre" TEXT,
    "pin" TEXT,
    "biyometriAktif" BOOLEAN NOT NULL DEFAULT false,
    "rol" TEXT NOT NULL DEFAULT 'resepsiyon',
    "checkInYetki" BOOLEAN NOT NULL DEFAULT true,
    "odaDegistirmeYetki" BOOLEAN NOT NULL DEFAULT true,
    "bilgiDuzenlemeYetki" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Kullanici_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Oda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisId" TEXT NOT NULL,
    "odaNumarasi" TEXT NOT NULL,
    "odaTipi" TEXT NOT NULL,
    "kapasite" INTEGER NOT NULL,
    "fotograf" TEXT,
    "not" TEXT,
    "durum" TEXT NOT NULL DEFAULT 'bos',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Oda_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Misafir" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "odaId" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "soyad" TEXT NOT NULL,
    "kimlikNo" TEXT NOT NULL,
    "pasaportNo" TEXT,
    "dogumTarihi" DATETIME NOT NULL,
    "uyruk" TEXT NOT NULL,
    "girisTarihi" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cikisTarihi" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Misafir_odaId_fkey" FOREIGN KEY ("odaId") REFERENCES "Oda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Bildirim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisId" TEXT NOT NULL,
    "misafirId" TEXT NOT NULL,
    "durum" TEXT NOT NULL,
    "hataMesaji" TEXT,
    "denemeSayisi" INTEGER NOT NULL DEFAULT 0,
    "sonDenemeTarihi" DATETIME,
    "kbsTuru" TEXT NOT NULL,
    "kbsYanit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bildirim_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Bildirim_misafirId_fkey" FOREIGN KEY ("misafirId") REFERENCES "Misafir" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisId" TEXT NOT NULL,
    "islem" TEXT NOT NULL,
    "detay" TEXT,
    "kullaniciId" TEXT,
    "basarili" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Log_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Hata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisId" TEXT NOT NULL,
    "bildirimId" TEXT,
    "hataTipi" TEXT NOT NULL,
    "hataMesaji" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'acik',
    "cozumNotu" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Hata_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tesisId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "islem" TEXT NOT NULL,
    "eskiDeger" TEXT,
    "yeniDeger" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_tesisId_fkey" FOREIGN KEY ("tesisId") REFERENCES "Tesis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OTP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telefon" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "islemTipi" TEXT NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'beklemede',
    "denemeSayisi" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Tesis_tesisKodu_key" ON "Tesis"("tesisKodu");

-- CreateIndex
CREATE INDEX "Kullanici_tesisId_idx" ON "Kullanici"("tesisId");

-- CreateIndex
CREATE INDEX "Kullanici_email_idx" ON "Kullanici"("email");

-- CreateIndex
CREATE INDEX "Kullanici_telefon_idx" ON "Kullanici"("telefon");

-- CreateIndex
CREATE INDEX "Oda_tesisId_idx" ON "Oda"("tesisId");

-- CreateIndex
CREATE UNIQUE INDEX "Oda_tesisId_odaNumarasi_key" ON "Oda"("tesisId", "odaNumarasi");

-- CreateIndex
CREATE INDEX "Misafir_tesisId_idx" ON "Misafir"("tesisId");

-- CreateIndex
CREATE INDEX "Misafir_odaId_idx" ON "Misafir"("odaId");

-- CreateIndex
CREATE INDEX "Bildirim_tesisId_idx" ON "Bildirim"("tesisId");

-- CreateIndex
CREATE INDEX "Bildirim_misafirId_idx" ON "Bildirim"("misafirId");

-- CreateIndex
CREATE INDEX "Bildirim_durum_idx" ON "Bildirim"("durum");

-- CreateIndex
CREATE INDEX "Log_tesisId_idx" ON "Log"("tesisId");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "Hata_tesisId_idx" ON "Hata"("tesisId");

-- CreateIndex
CREATE INDEX "Hata_durum_idx" ON "Hata"("durum");

-- CreateIndex
CREATE INDEX "AuditLog_tesisId_idx" ON "AuditLog"("tesisId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "OTP_telefon_idx" ON "OTP"("telefon");

-- CreateIndex
CREATE INDEX "OTP_otp_idx" ON "OTP"("otp");

-- CreateIndex
CREATE INDEX "OTP_expiresAt_idx" ON "OTP"("expiresAt");

-- CreateIndex
CREATE INDEX "OTP_durum_idx" ON "OTP"("durum");
