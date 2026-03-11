-- RLS sıkılaştırma: tenants ve tenant_kullanicilar sadece merkez admin (is_admin()) tarafından okunup yönetilsin.
-- service_role (backend/Edge) RLS'i bypass eder; anon veya authenticated normal kullanıcı bu tablolara erişemez.

DROP POLICY IF EXISTS tenants_select_all ON public.tenants;
CREATE POLICY tenants_select_admin ON public.tenants
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS tenant_kullanicilar_own_tenant ON public.tenant_kullanicilar;
CREATE POLICY tenant_kullanicilar_admin ON public.tenant_kullanicilar
  FOR ALL USING (public.is_admin());

COMMENT ON POLICY tenants_select_admin ON public.tenants IS 'Sadece merkez admin tenant listesini görebilir.';
COMMENT ON POLICY tenant_kullanicilar_admin ON public.tenant_kullanicilar IS 'Sadece merkez admin tenant kullanıcılarını yönetebilir.';
