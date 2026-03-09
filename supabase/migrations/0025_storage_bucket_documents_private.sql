-- Pasaport / kimlik kartı okuma görselleri – herkese açık değil (private).
-- Backend: okutulan-belgeler veya edge function ile yükleme; okuma için signed URL kullanılır.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Sadece giriş yapmış kullanıcılar yükleyebilir
DROP POLICY IF EXISTS "documents_insert_authenticated" ON storage.objects;
CREATE POLICY "documents_insert_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Sadece giriş yapmış kullanıcılar okuyabilir (public okuma yok)
DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
CREATE POLICY "documents_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

-- Güncelleme/silme: authenticated (uygulama tarafında path/branch kısıtı uygulanabilir)
DROP POLICY IF EXISTS "documents_update_authenticated" ON storage.objects;
CREATE POLICY "documents_update_authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_delete_authenticated" ON storage.objects;
CREATE POLICY "documents_delete_authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');
