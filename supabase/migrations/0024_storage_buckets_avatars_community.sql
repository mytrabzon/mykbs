-- Profil resimleri (avatars) ve topluluk paylaşım resimleri (community) için storage bucket'ları.
-- Profil: upload_avatar edge function → avatars bucket.
-- Topluluk: upload_community_image edge function → community bucket.

-- 1) Bucket'ları oluştur (yoksa)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('community', 'community', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- 2) RLS: avatars – sadece kendi dosyasını yükleyebilir/güncelleyebilir (path = userId.ext, klasör yok)
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name LIKE (auth.jwt()->>'sub') || '.%'
  AND name NOT LIKE '%/%'
);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND name LIKE (auth.jwt()->>'sub') || '.%'
  AND name NOT LIKE '%/%'
)
WITH CHECK (bucket_id = 'avatars');

-- 3) RLS: community – authenticated kullanıcılar yükleyebilir (branch_id edge function'da doğrulanıyor)
DROP POLICY IF EXISTS "community_insert_authenticated" ON storage.objects;
CREATE POLICY "community_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'community');

-- 4) Her iki bucket public olduğu için okuma: herkese açık (anon + authenticated)
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "community_select_public" ON storage.objects;
CREATE POLICY "community_select_public"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'community');
