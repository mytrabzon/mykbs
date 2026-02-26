-- user_push_tokens (Expo push) ve notification_outbox / in_app eksik alanlar
-- 0002'de notification_outbox'ta last_error, sent_at yoksa ekle

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_outbox' AND column_name = 'last_error') THEN
    ALTER TABLE notification_outbox ADD COLUMN last_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_outbox' AND column_name = 'sent_at') THEN
    ALTER TABLE notification_outbox ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- in_app_notifications: is_read (bazı şemalarda read_at var)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'in_app_notifications' AND column_name = 'is_read') THEN
    ALTER TABLE in_app_notifications ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- post_comments soft delete
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_comments' AND column_name = 'is_deleted') THEN
    ALTER TABLE post_comments ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE post_comments ADD COLUMN deleted_at TIMESTAMPTZ;
    ALTER TABLE post_comments ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- user_push_tokens
CREATE TABLE IF NOT EXISTS user_push_tokens (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_push_tokens_all" ON user_push_tokens;
CREATE POLICY "user_push_tokens_all"
  ON user_push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
