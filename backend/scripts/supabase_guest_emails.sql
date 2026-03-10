-- Supabase SQL Editor'da çalıştırın. Misafir hesap sayacı (misafir01_, misafir02_...) için.
-- Backend POST /api/auth/guest/create bu tabloyu kullanır.
-- Tablo yoksa backend yine hesap açar ama numara her seferinde 1 kalır; admin panelde ayırt etmek için tabloyu oluşturun.

CREATE TABLE IF NOT EXISTS public.guest_emails (
  email text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

-- RLS: backend service_role ile yazıp okuyacak; anon erişim yok.
ALTER TABLE public.guest_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access guest_emails"
  ON public.guest_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
