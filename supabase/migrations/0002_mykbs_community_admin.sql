-- MYKBS Community + Admin: posts, comments, reactions, notifications
-- Trigger sözdizimi: EXECUTE PROCEDURE (PostgreSQL 14+)

-- user_profiles: moderator rolü ve display_name
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'staff', 'moderator'));

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- posts (community)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'post' CHECK (type IN ('post', 'announcement')),
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT,
  body TEXT NOT NULL,
  media JSONB,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_branch ON posts(branch_id);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_branch_deleted ON posts(branch_id, is_deleted);

-- post_comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_branch ON post_comments(branch_id);

-- post_reactions (unique: post_id + user_id)
CREATE TABLE IF NOT EXISTS post_reactions (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_branch ON post_reactions(branch_id);

-- in_app_notifications
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT,
  body TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user ON in_app_notifications(user_id);

-- notification_outbox (push/queue)
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  target_user_ids UUID[] NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_status ON notification_outbox(status);

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger: posts.updated_at (EXECUTE PROCEDURE)
DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE PROCEDURE set_updated_at();

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- posts: branch bazlı; silinmişleri sadece admin/moderator görebilir (uygulama tarafında filtre)
CREATE POLICY "posts_policy"
  ON posts FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "post_comments_policy"
  ON post_comments FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "post_reactions_policy"
  ON post_reactions FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "in_app_notifications_policy"
  ON in_app_notifications FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_outbox_policy"
  ON notification_outbox FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );
