# Admin Panel: Supabase Token Süresi ve Yenileme

## Sorun

Supabase ile giriş yaptığınızda (E-posta + Şifre → Supabase sekmesi) access token yaklaşık **1 saat** sonra sona erer. Token süresi dolunca "Oturum süresi doldu veya geçersiz. Lütfen tekrar giriş yapın." hatası alırsınız.

## Yapılan İyileştirmeler

1. **Refresh token saklama:** Girişte hem `access_token` hem `refresh_token` kaydediliyor.
2. **Otomatik yenileme:** Edge/API isteklerinde önce mevcut session kontrol ediliyor; 401 alınırsa `refresh_token` ile yeni access token alınıp istek tekrarlanıyor.
3. **Çıkışta temizlik:** Çıkış yapınca tüm Supabase token’ları siliniyor.

## Hâlâ "Süresi geçti / token geçersiz" alıyorsanız

1. **Çıkış yapıp tekrar giriş yapın** (Supabase sekmesi, sonertoprak97@gmail.com + şifre). Böylece yeni access + refresh token alırsınız.
2. **Hesabın admin olduğundan emin olun:** Supabase Dashboard → SQL Editor’da aşağıdaki script’i çalıştırın (UID zaten 67fe79fc... ise sadece kontrol/tekrar atama yapar).

## Admin hesabını yeniden tanımlama (Supabase SQL)

`sonertoprak97@gmail.com` (UID: `67fe79fc-b6ac-4f45-a436-88e30e3171ef`) için profiles, user_profiles ve app_roles kayıtlarını oluşturmak/güncellemek için:

```sql
-- sonertoprak97@gmail.com = 67fe79fc-b6ac-4f45-a436-88e30e3171ef
DO $$
DECLARE
  admin_user_id UUID := '67fe79fc-b6ac-4f45-a436-88e30e3171ef';
  branch_id UUID;
BEGIN
  SELECT id INTO branch_id FROM public.branches LIMIT 1;
  IF branch_id IS NULL THEN
    INSERT INTO public.organizations (name) VALUES ('KBS Sistem');
    INSERT INTO public.branches (organization_id, name)
    SELECT id, 'Merkez' FROM public.organizations ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO branch_id FROM public.branches ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF branch_id IS NOT NULL THEN
    UPDATE public.user_profiles SET role = 'admin' WHERE user_id = admin_user_id;
    IF NOT FOUND THEN
      INSERT INTO public.user_profiles (user_id, branch_id, role, display_name)
      VALUES (admin_user_id, branch_id, 'admin', 'Admin');
    END IF;
  END IF;

  INSERT INTO public.profiles (id, is_admin, updated_at)
  VALUES (admin_user_id, true, now())
  ON CONFLICT (id) DO UPDATE SET is_admin = true, updated_at = now();
  UPDATE public.profiles SET role = 'super_admin', is_super_admin = true WHERE id = admin_user_id;

  INSERT INTO public.app_roles (user_id, role)
  VALUES (admin_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
END $$;
```

Bu script’i çalıştırdıktan sonra **çıkış yapıp tekrar Supabase ile giriş yapın**.

## Alternatif: E-posta + Şifre (Backend) ile giriş

Admin panelde **E-posta + Şifre** sekmesi backend JWT kullanır; süre varsayılan **7 gün**dür. Bu hesabın backend’de de kayıtlı olması gerekir (Kullanıcı adı/şifre backend’de tanımlı olmalı). Sadece Supabase Auth kullanıyorsanız önce bu SQL ile profilleri tanımlayıp Supabase sekmesinden giriş yapın.
