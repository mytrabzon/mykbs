-- MYKBS Supabase schema + RLS
-- organizations, branches, user_profiles, guests, documents, scans, notifications, audit_logs

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  nationality TEXT,
  document_type TEXT,
  document_no TEXT,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  storage_path TEXT,
  sha256 TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  ocr_json JSONB,
  quality_score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed');

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_branches_organization ON branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_branch ON user_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_guests_branch ON guests(branch_id);
CREATE INDEX IF NOT EXISTS idx_documents_branch ON documents(branch_id);
CREATE INDEX IF NOT EXISTS idx_notifications_branch_status ON notifications(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id);

-- RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- user_profiles: kullanıcı kendi branch'ındaki profili görebilir; admin tüm branch'ları görebilir
CREATE POLICY "user_profiles_select_own_branch"
  ON user_profiles FOR SELECT
  USING (
    branch_id IN (
      SELECT branch_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "user_profiles_admin_all"
  ON user_profiles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- branches: sadece kendi branch'ı veya admin
CREATE POLICY "branches_select"
  ON branches FOR SELECT
  USING (
    id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- organizations: branch üzerinden erişim
CREATE POLICY "organizations_select"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM branches
      WHERE id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- guests: branch bazlı
CREATE POLICY "guests_policy"
  ON guests FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- documents, scans: branch bazlı
CREATE POLICY "documents_policy"
  ON documents FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "scans_select"
  ON scans FOR SELECT
  USING (
    document_id IN (SELECT id FROM documents WHERE branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "scans_insert"
  ON scans FOR INSERT
  WITH CHECK (
    document_id IN (SELECT id FROM documents WHERE branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid()))
  );

-- notifications: branch bazlı
CREATE POLICY "notifications_policy"
  ON notifications FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );

-- audit_logs: branch bazlı
CREATE POLICY "audit_logs_policy"
  ON audit_logs FOR ALL
  USING (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    branch_id IN (SELECT branch_id FROM user_profiles WHERE user_id = auth.uid())
  );
