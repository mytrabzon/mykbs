-- Prisma Tesis modelinde trialEndsAt var; Supabase'te kolon eksikse ekle (kayıt + /api/tesis için).
ALTER TABLE public."Tesis" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP WITH TIME ZONE;
