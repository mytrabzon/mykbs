-- Backend Kullanici.id artık CUID (string); app_roles.backend_kullanici_id BIGINT idi, 22P02 hatası veriyordu.
-- Sütunu TEXT yapıyoruz ki CUID değerleri (örn. cmm79iqoh000217cnmz4r3ut1) ile eşleşebilsin.
ALTER TABLE public.app_roles
  ALTER COLUMN backend_kullanici_id TYPE TEXT USING (backend_kullanici_id::text);

COMMENT ON COLUMN public.app_roles.backend_kullanici_id IS 'Backend Prisma Kullanici.id (CUID string).';
