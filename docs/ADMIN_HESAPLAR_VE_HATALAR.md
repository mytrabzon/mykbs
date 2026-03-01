# Admin hesaplar, ana admin, Twilio OTP ve /me 401

## 1. Kaç admin kullanıcı var?

Admin sayısı **iki yerden** geliyor:

### Backend (Prisma)

- **Ana admin (tek kişi):** `.env` içinde `ADMIN_KULLANICI_ID=<Prisma Kullanici id>` ile tanımlı. Bu id’ye sahip kullanıcı uygulama içi admin panelinde admin sayılır.
- **Diğer adminler:** Supabase `app_roles` tablosunda `backend_kullanici_id` = Prisma Kullanici id ve `role = 'admin'` olan satırlar.
- **Tesis bazlı yetki:** Prisma `Kullanici.rol` = `sahip` veya `yonetici` olanlar o tesiste yetkili (admin sayısına ayrıca bakılabilir).

**Sayıyı görmek için (backend veritabanında):**

```sql
-- Ana admin (env'deki id)
-- ADMIN_KULLANICI_ID değerini .env'den alın; aşağıda 1 örnek.
SELECT id, "adSoyad", "tesisId", rol FROM "Kullanici" WHERE id = 1;

-- Rolü sahip veya yonetici olanlar (tesis bazlı)
SELECT id, "adSoyad", "tesisId", rol FROM "Kullanici" WHERE rol IN ('sahip', 'yonetici');
```

### Supabase

- **`profiles.is_admin = true`:** `public.profiles` tablosunda `id` = auth user UUID ve `is_admin = true` olanlar.
- **`app_roles.role = 'admin'`:** `public.app_roles` tablosunda `user_id` = Supabase auth UUID ve `role = 'admin'` olanlar (veya `backend_kullanici_id` ile eşleşen backend kullanıcıları).

**Sayıyı görmek için (Supabase SQL Editor):**

```sql
-- profiles.is_admin
SELECT id, is_admin FROM public.profiles WHERE is_admin = true;

-- app_roles admin
SELECT user_id, role, backend_kullanici_id FROM public.app_roles WHERE role = 'admin';
```

Toplam admin sayısı = (Backend’de ADMIN_KULLANICI_ID + app_roles’taki backend adminler) + (Supabase’te profiles.is_admin + app_roles’taki Supabase adminler). Aynı kişi hem Prisma hem Supabase’te sayılabileceği için tekilleştirmek isterseniz kullanıcı bazında düşünmek gerekir.

---

## 2. Ana admin hesabı hangisi?

- **Backend:** Ana admin, `.env` içindeki **`ADMIN_KULLANICI_ID`** ile tanımlı Prisma `Kullanici` kaydıdır. Örnek: `ADMIN_KULLANICI_ID=1` ise `Kullanici.id = 1` olan kullanıcı ana admindir. Bu değer backend’de `auth.js` ve `appAdmin.js` içinde kullanılıyor.
- **Supabase:** Migrasyonlarda sabit tanımlı “süper admin” UUID: **`f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7`** (telefon: 905330483061). Bu kullanıcı:
  - `supabase/migrations/0010_super_admin_f7cfe2ef.sql` ile `user_profiles.role = 'admin'` yapılıyor,
  - `0011_profiles_is_admin.sql` ile `profiles.is_admin = true` yapılıyor,
  - `0012_backend_auth_kbs_credentials.sql` ile `app_roles(user_id, role)` = (`f7cfe2ef-...`, `'admin'`) ekleniyor.

Yani **ana admin hesabı:** Backend tarafında `ADMIN_KULLANICI_ID`, Supabase tarafında UUID `f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7` (905330483061).

---

## 3. Twilio 422 – "Error sending confirmation OTP to provider: Authenticate"

Log örneği:

```text
"error\":\"422: Error sending confirmation OTP to provider: Authenticate More information: https://www.twilio.com/docs/errors/20003\"
```

**Twilio 20003** = Kimlik doğrulama hatası: Twilio’ya giden istekte **Account SID** veya **Auth Token** hatalı / süresi dolmuş.

**Yapılacaklar:**

1. **Supabase Dashboard** → **Authentication** → **Providers** → **Phone**.
2. Twilio **Account SID** ve **Auth Token**’ı kontrol edin (Twilio Console’dan kopyalayın).
3. Auth Token’ı yenilediyseniz Supabase’teki değeri güncelleyin.
4. [Twilio 20003](https://www.twilio.com/docs/errors/20003) dokümanında belirtilenler: hesap askıya alınmış mı, kredi var mı, doğru hesap mı kontrol edin.

Bu hata **SMS OTP** (telefon ile giriş/kayıt) akışında oluşur; düzeltme tamamen Twilio bilgilerinin doğru ve güncel olmasına bağlıdır.

---

## 4. Supabase Edge `/me` 401

**POST** `https://...supabase.co/functions/v1/me` → **401** dönüyor.

Edge’deki `me` fonksiyonu `_shared/auth.ts` içindeki **`requireAuth(req)`** kullanıyor:

- **401** döndüğü yerler:
  - **Authorization** header yok veya **Bearer** token yok.
  - `supabase.auth.getUser(token)` başarısız (token geçersiz / süresi dolmuş / yanlış proje).

Yani 401 = “Token yok veya geçersiz”. **403** “Kullanici profili bulunamadi” (NO_PROFILE) = `user_profiles` tablosunda bu kullanıcı için satır yok.

**Yapılacaklar:**

1. **Token tipi:** `/me` sadece **Supabase Auth JWT** (access_token) ile çalışır. Backend JWT ile çağrı yapılıyorsa 401 normaldir; mobil tarafta Supabase ile giriş yapıldığında **Supabase access_token**’ın `Authorization: Bearer <token>` ile gönderildiğinden emin olun.
2. **Süre:** Token süresi dolmuşsa 401 gelir; oturum yenileme (refresh) sonrası yeni access_token ile tekrar deneyin.
3. **403 NO_PROFILE:** 401 değil 403 alıyorsanız, bu kullanıcı için `user_profiles` satırı eksiktir. Supabase’te ilgili `user_id` (auth UUID) için `user_profiles`’ta en az bir satır (tercihen `branch_id` dolu) olmalı; yoksa [OTURUM_401_NEDENLERI.md](./OTURUM_401_NEDENLERI.md) veya migration’lardaki `user_profiles` örneklerine göre ekleyin.

Log’daki kullanıcı **f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7** zaten süper admin olarak migration’larda tanımlı; bu kullanıcı için `user_profiles` satırı normalde var. 401 alınıyorsa büyük olasılıkla gönderilen token eksik, yanlış veya süresi dolmuştur.

---

## Özet tablo

| Konu | Nerede | Değer / Kontrol |
|------|--------|------------------|
| Kaç admin | Backend | `ADMIN_KULLANICI_ID` + `app_roles` (backend_kullanici_id) + Prisma `Kullanici.rol` (sahip/yonetici) |
| Kaç admin | Supabase | `profiles.is_admin = true` + `app_roles.role = 'admin'` |
| Ana admin (backend) | .env | `ADMIN_KULLANICI_ID` = Prisma Kullanici id |
| Ana admin (Supabase) | Migration | UUID `f7cfe2ef-00bd-4c70-b40d-c5b55e1c52d7` (905330483061) |
| Twilio 422 / 20003 | Supabase Auth → Phone | Twilio Account SID / Auth Token doğru ve güncel olmalı |
| /me 401 | Edge + Auth | Supabase JWT gönderilmeli; token geçerli/süresi dolmamış olmalı |
| /me 403 NO_PROFILE | Supabase | `user_profiles`’ta ilgili user_id için satır olmalı |
