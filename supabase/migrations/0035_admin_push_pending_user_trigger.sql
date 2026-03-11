-- Onay bekleyen kullanıcı (user_profiles.approval_status = 'pending') eklendiğinde/güncellendiğinde
-- admin ve moderator hesaplara push bildirimi kuyruğa alınır (notification_outbox).
-- push_dispatch (cron veya backend tetiklemesi) kuyruğu işleyip Expo push gönderir.

CREATE OR REPLACE FUNCTION public.notify_admins_pending_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
  v_admin_ids UUID[];
  v_body TEXT;
BEGIN
  IF NEW.approval_status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.approval_status = 'pending' THEN
    RETURN NEW; -- zaten pending idi, tekrar bildirim gönderme
  END IF;

  SELECT id INTO v_branch_id FROM branches LIMIT 1;
  IF v_branch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(user_id) INTO v_admin_ids
  FROM user_profiles
  WHERE role IN ('admin', 'moderator')
    AND (is_disabled IS NULL OR is_disabled = false);
  IF v_admin_ids IS NULL OR array_length(v_admin_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_body := COALESCE(NULLIF(TRIM(NEW.display_name), ''), 'Yeni kullanıcı') || ' onay bekliyor.';

  INSERT INTO notification_outbox (branch_id, target_user_ids, payload, status)
  VALUES (
    v_branch_id,
    v_admin_ids,
    jsonb_build_object(
      'title', 'Onay bekleyen kullanıcı',
      'body', v_body,
      'data', jsonb_build_object('type', 'pending_user', 'user_id', NEW.user_id)
    ),
    'queued'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_admins_pending_user ON user_profiles;
CREATE TRIGGER trigger_notify_admins_pending_user
  AFTER INSERT OR UPDATE OF approval_status
  ON user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_admins_pending_user();

COMMENT ON FUNCTION public.notify_admins_pending_user() IS 'user_profiles approval_status pending olduğunda admin/moderator için notification_outbox kaydı ekler.';
