# Production Kurulum Rehberi

Bu dokümanda production ortamında güvenli şekilde çalıştırmak için yapmanız gereken adımlar özetleniyor.

---

## 1. Production Backend (.env)

Backend’in çalıştığı sunucuda (VPS, Railway vb.) `.env` dosyasında **mutlaka** şunlar olmalı:

| Değişken | Açıklama |
|----------|----------|
| **JWT_SECRET** | Güçlü, benzersiz, en az 32 karakter. Örn: `openssl rand -base64 32` ile üretin. |
| **ADMIN_SECRET** | Panel şifresi; admin panel ile **aynı** değer kullanılacak. Güçlü ve benzersiz. |

**Opsiyonel:**

| Değişken | Açıklama |
|----------|----------|
| **CORS_ORIGIN** | Sadece panel domain’inize izin verin. Birden fazla için virgül: `https://panel-alanadiniz.com,https://www.panel-alanadiniz.com` |

**Örnek (gerçek değerleri kendi ortamınıza göre yazın):**
```env
JWT_SECRET=xxxxxxxx-32-karakter-veya-uzun-rastgele-string
ADMIN_SECRET=xxxxxxxx-backend-ve-panel-ayni
CORS_ORIGIN=https://panel-alanadiniz.com
```

---

## 2. Production Admin Panel (.env.local veya deploy env)

Admin panel build’inden **önce** (veya deploy ortamında) şu değişkenler tanımlı olmalı:

| Değişken | Açıklama |
|----------|----------|
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase proje URL’iniz (örn. `https://xxx.supabase.co`) |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase Dashboard → Settings → API → anon public key |
| **NEXT_PUBLIC_ADMIN_SECRET** | Backend’deki **ADMIN_SECRET** ile **birebir aynı** değer |

Build sırasında bu değerler koda gömülür; production’da doğru Supabase ve panel şifresi kullanılır.

**Örnek:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_ADMIN_SECRET=cu30sxrosb4qz2in6zi631zkv
```

---

## 3. Supabase Edge (Production)

Stub giriş **sadece test** içindir. Production’da kapalı olmalı.

Supabase Dashboard → **Edge Functions** → ilgili fonksiyonlar için **Secrets** bölümünde:

- **ALLOW_STUB_LOGIN** tanımlı **olmasın** veya değeri **false** olsun (auth_login için).
- **ALLOW_STUB_OTP** tanımlı **olmasın** veya değeri **false** olsun (auth_verify_otp için).

Bu değişkenler `true` olmadığı sürece stub giriş devre dışı kalır; production’da OTP veya backend ile giriş kullanılır.

---

## 4. Migration: 0033_tenants_rls_restrict_admin_only

Bu migration, `tenants` ve `tenant_kullanicilar` tablolarında RLS’i sıkılaştırır: sadece merkez admin (`is_admin()`) bu tabloları okuyup yönetebilir.

**Nasıl çalıştırılır:**

- **Supabase CLI** kullanıyorsanız proje kökünde:
  ```bash
  supabase db push
  ```
  veya sadece bu migration’ı işaretleyip push ediyorsanız mevcut akışınızla devam edin.

- **Supabase Dashboard** kullanıyorsanız: **SQL Editor**’de `supabase/migrations/0033_tenants_rls_restrict_admin_only.sql` dosyasının içeriğini açıp çalıştırın.

Migration sonrası davranış: `tenants` ve `tenant_kullanicilar` sadece admin kullanıcılar tarafından erişilebilir; normal kullanıcılar bu tablolara erişemez.

---

## Özet kontrol listesi

- [ ] Backend `.env`: `JWT_SECRET`, `ADMIN_SECRET` güçlü ve benzersiz
- [ ] Backend `.env`: İsterseniz `CORS_ORIGIN` panel domain’inize ayarlandı
- [ ] Admin panel build/deploy env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_SECRET` (backend ile aynı)
- [ ] Supabase Edge: `ALLOW_STUB_LOGIN` ve `ALLOW_STUB_OTP` yok veya false
- [ ] Migration `0033_tenants_rls_restrict_admin_only.sql` Supabase’de uygulandı

Bu adımlarla mevcut davranış korunur; production’da güvenlik açıkları kapatılmış ve kimlik/pasaport verileri raporda sadece maskeli ve HTML escape’li kullanılmış olur.
