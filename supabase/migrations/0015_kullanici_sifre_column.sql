-- Prisma Kullanici modelinde sifre var; Supabase/Postgres'te kolon eksikse ekle (kayıt supabase-create için).
ALTER TABLE public."Kullanici" ADD COLUMN IF NOT EXISTS "sifre" TEXT;
