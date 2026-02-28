-- Profil alanları: displayName, title, avatarUrl (e-posta/telefon/tesis kodu farketmez tüm girişler kullanabilir)
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
