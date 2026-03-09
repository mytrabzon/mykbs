-- Gereksiz tekrarı kaldır: updated_at için tek fonksiyon kullan (set_updated_at).
-- Önceden: set_updated_at (posts), touch_updated_at (kbs_outbox), set_verification_sessions_updated_at (verification_sessions)
-- Hepsi aynı mantık: NEW.updated_at = now(); RETURN NEW;

-- 1) set_updated_at public schema'da yoksa oluştur (0002'de oluşturulmuş olabilir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2) kbs_outbox: touch_updated_at yerine set_updated_at kullan
DROP TRIGGER IF EXISTS trg_kbs_outbox_updated ON public.kbs_outbox;
CREATE TRIGGER trg_kbs_outbox_updated
  BEFORE UPDATE ON public.kbs_outbox
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 3) verification_sessions: set_verification_sessions_updated_at yerine set_updated_at kullan
DROP TRIGGER IF EXISTS verification_sessions_updated_at ON public.verification_sessions;
CREATE TRIGGER verification_sessions_updated_at
  BEFORE UPDATE ON public.verification_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- 4) Gereksiz fonksiyonları kaldır (artık hiçbir trigger bunları kullanmıyor)
DROP FUNCTION IF EXISTS public.touch_updated_at();
DROP FUNCTION IF EXISTS public.set_verification_sessions_updated_at();

-- posts_updated_at zaten set_updated_at kullanıyor (0002), değişiklik yok.
