-- Genel optimizasyon: branches konum/KBS alanları, sorgu indexleri
-- Kimlik bildirimi (KBS) bağlantısı yoksa uygulama hata vermez; konum opsiyonel.

-- 1) Branches: konum (opsiyonel) ve KBS yapılandırma durumu
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'latitude') THEN
    ALTER TABLE branches ADD COLUMN latitude NUMERIC(10, 7);
    ALTER TABLE branches ADD COLUMN longitude NUMERIC(10, 7);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'kbs_configured') THEN
    ALTER TABLE branches ADD COLUMN kbs_configured BOOLEAN NOT NULL DEFAULT false;
    COMMENT ON COLUMN branches.kbs_configured IS 'Kimlik bildirimi (Jandarma/Polis) bu tesis için yapılandırıldı mı';
  END IF;
END $$;

-- 2) Sorgu performansı: created_at indexleri (tarih filtreleri için)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_outbox_created_at ON notification_outbox(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guests_created_at ON guests(created_at DESC);

-- 3) Branch bazlı listeleme (RLS ve liste sorguları)
CREATE INDEX IF NOT EXISTS idx_notification_outbox_branch_status ON notification_outbox(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_guests_branch_created ON guests(branch_id, created_at DESC);

-- 4) user_profiles: auth.uid() ile tek sorguda branch_id (Edge Functions için)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 5) RLS hızlandırma: kullanıcının branch_id listesini dönen helper (opsiyonel, policy'lerde kullanılabilir)
CREATE OR REPLACE FUNCTION public.current_user_branch_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM user_profiles WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_branch_ids() IS 'RLS policylerde kullanılmak üzere giriş yapan kullanıcının branch_id listesi';