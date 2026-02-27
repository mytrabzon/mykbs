# "Oturum doğrulanamadı" / 401 Neden Olur?

Backend **401 "Geçersiz token"** döndüğünde oturum açılmıyor gibi görünür. Olası nedenler:

## 1. Token süresi dolmuş

- **Supabase:** `access_token` genelde ~1 saat geçerli. Uygulama kapalıyken süre dolduysa, açılışta eski token gider → 401.
- **Backend JWT (tesis kodu+PIN veya telefon+şifre):** `JWT_EXPIRES_IN` (örn. 7 gün) sonrası token geçersiz → 401.

**Ne yapıldı:** Açılışta Supabase için `refreshSession()` ile token yenileniyor; hâlâ 401 alınıyorsa oturum temizlenip giriş ekranına dönülüyor.

## 2. Supabase kullanıcısında `user_profiles` yok (en sık neden)

**SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY her yerde olsa bile** backend yine 401 verebilir; çünkü token doğrulandıktan sonra **user_profiles** kontrolü yapılıyor.

Akış:
1. Backend gelen token ile `supabase.auth.getUser(token)` yapar → kullanıcı geçerli.
2. Sonra `user_profiles` tablosunda `user_id = bu kullanıcının id` ve `branch_id` dolu bir satır aranır.
3. **Böyle bir satır yoksa** backend Supabase tarafını kabul etmez, legacy JWT’e düşer; o da yoksa → **401 "Geçersiz token"**.

Yani: **Kayıtlı hesap “atılıyorsa” çoğu zaman sebep:** Bu kullanıcı Supabase `auth.users` içinde var ama **user_profiles’da bu user_id için (ve branch_id’li) kayıt yok**.

**Kontrol:** Supabase Dashboard → Table Editor → **user_profiles** → giriş yapan kullanıcının **user_id** (auth.users’taki id) ile bir satır var mı, **branch_id** dolu mu?

**Düzeltme:** Eksikse bu kullanıcı için bir branch + user_profiles kaydı eklenmeli. Örneğin mevcut bir branch’e bağlamak için:

```sql
-- Örnek: user_id ve branch_id (branches tablosundan bir id) ile kayıt ekle
INSERT INTO public.user_profiles (user_id, branch_id, role, display_name)
VALUES (
  'BURAYA_AUTH_USERS_ID_UUID',
  (SELECT id FROM branches LIMIT 1),
  'staff',
  'Kullanıcı'
)
ON CONFLICT (user_id) DO UPDATE SET branch_id = EXCLUDED.branch_id;
```

(Not: `user_profiles` primary key’i tek kolonsa `user_id`; composite ise schema’ya göre ON CONFLICT ifadesi güncellenmeli.)

## 3. Yanlış token gönderilmesi

- Giriş **backend** (PIN veya telefon+şifre) ile yapıldı → token **backend JWT**.
- Giriş **Supabase** (SMS OTP vb.) ile yapıldı → token **Supabase access_token**.

Backend her iki türü de kabul eder (`authenticateTesisOrSupabase`). Ama cihazda yanlış veya karışık token saklanıyorsa (ör. farklı giriş türünden kalan eski token) → 401.

**Ne yapıldı:** 401 alındığında oturum tamamen temizlenip giriş ekranına dönülüyor; kullanıcı tekrar doğru hesapla giriş yapabilir.

## 4. Backend’de Supabase yapılandırması eksik

`authTesisOrSupabase` middleware’i Supabase token’ı doğrulamak için `supabaseAdmin.auth.getUser(token)` kullanır. Backend ortamında:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

tanımlı değilse veya yanlışsa Supabase doğrulaması çalışmaz, sadece legacy JWT kalır; token Supabase ise → 401.

**Kontrol:** Backend `.env` / Railway Variables’da `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` doğru mu?

---

## Özet

Oturum “açılmıyor” / 401 almanın pratik nedenleri:

1. **Süresi dolmuş token** → Açılışta refresh denendi; yine 401 ise çıkış + giriş ekranı.
2. **Supabase kullanıcısının `user_profiles` (ve branch) kaydı yok** → Supabase’de bu kullanıcı için profil/branch oluşturulmalı.
3. **Backend’de Supabase env eksik/yanlış** → `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` kontrol edilmeli.

Bu üçü düzgünse ve hâlâ 401 alıyorsan, backend log’unda `getUser` veya `jwt.verify` hata mesajına bakmak gerekir.
