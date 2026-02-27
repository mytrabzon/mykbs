-- Backend tek otorite: request/approve KBS tesis bilgisi, push kayıt, admin rol.
-- auth.users kullanılmıyor; kullanıcı kimliği backend JWT (Prisma veya ileride app_users.id).

-- 3.1 Requests (bekleyen talepler) — branch_id veya backend_tesis_id ile
CREATE TABLE IF NOT EXISTS public.facility_credentials_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  branch_id UUID,
  backend_user_id BIGINT,
  backend_tesis_id BIGINT,
  tesis_kodu TEXT NOT NULL,
  web_servis_sifre TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMPTZ NULL,
  reject_reason TEXT NULL,
  CONSTRAINT fcr_branch_or_tesis CHECK (
    (branch_id IS NOT NULL AND backend_tesis_id IS NULL) OR
    (branch_id IS NULL AND backend_tesis_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS fcr_user_status_idx ON public.facility_credentials_requests(backend_user_id, status) WHERE backend_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fcr_user_id_status_idx ON public.facility_credentials_requests(user_id, status) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fcr_status_created_idx ON public.facility_credentials_requests(status, created_at);
CREATE INDEX IF NOT EXISTS fcr_backend_tesis_idx ON public.facility_credentials_requests(backend_tesis_id, status) WHERE backend_tesis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fcr_branch_idx ON public.facility_credentials_requests(branch_id, status) WHERE branch_id IS NOT NULL;

-- 3.2 Approved (onaylı kayıt) — branch_id veya backend_tesis_id
CREATE TABLE IF NOT EXISTS public.facility_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  branch_id UUID,
  backend_user_id BIGINT,
  backend_tesis_id BIGINT,
  tesis_kodu TEXT NOT NULL,
  web_servis_sifre_enc TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fc_branch_or_tesis CHECK (
    (branch_id IS NOT NULL AND backend_tesis_id IS NULL) OR
    (branch_id IS NULL AND backend_tesis_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS fc_backend_uniq ON public.facility_credentials(backend_tesis_id, backend_user_id) WHERE backend_tesis_id IS NOT NULL AND backend_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fc_branch_user_uniq ON public.facility_credentials(branch_id, user_id) WHERE branch_id IS NOT NULL AND user_id IS NOT NULL;

-- 3.3 İsteğe bağlı: backend auth için app_users (ileride kullanım)
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_disabled BOOLEAN NOT NULL DEFAULT false
);

-- 3.4 Admin kontrolü (Supabase UID veya backend kullanıcı id ile)
CREATE TABLE IF NOT EXISTS public.app_roles (
  user_id UUID PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  backend_kullanici_id BIGINT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin UID (Supabase auth kullanılırsa)
INSERT INTO public.app_roles(user_id, role)
VALUES ('f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7'::uuid, 'admin')
ON CONFLICT (user_id) DO UPDATE SET role='admin';

-- Push token kayıtları (backend JWT ile; auth.users'a bağlı değil)
CREATE TABLE IF NOT EXISTS public.push_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_identifier TEXT NOT NULL,
  expo_push_token TEXT NOT NULL,
  device_id TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_reg_user_token ON public.push_registrations(user_identifier, expo_push_token);
CREATE INDEX IF NOT EXISTS push_reg_user ON public.push_registrations(user_identifier);

-- RLS: backend service_role ile erişir; policy gerekmez
ALTER TABLE facility_credentials_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcr_service" ON facility_credentials_requests;
CREATE POLICY "fcr_service" ON facility_credentials_requests FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "fc_service" ON facility_credentials;
CREATE POLICY "fc_service" ON facility_credentials FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_users_service" ON app_users;
CREATE POLICY "app_users_service" ON app_users FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_roles_service" ON app_roles;
CREATE POLICY "app_roles_service" ON app_roles FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "push_reg_service" ON push_registrations;
CREATE POLICY "push_reg_service" ON push_registrations FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.facility_credentials_requests IS 'KBS tesis bilgisi talepleri; admin onayından sonra facility_credentials''a yansır.';
COMMENT ON TABLE public.facility_credentials IS 'Onaylı KBS tesis kodu/şifre (şifre encrypt).';
COMMENT ON TABLE public.push_registrations IS 'Backend JWT ile kayıt; user_identifier = backend userId (Prisma veya app_users).';
