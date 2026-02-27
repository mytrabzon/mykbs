# Telefon vs E-posta: Kayıt ve Kullanıcı Oluşumu

## Kısa cevap

- **Telefon ile kayıt** → Kullanıcı **oluşuyor** (Prisma + Supabase `user_profiles`).  
- **E-posta ile ayrı bir kayıt akışı yok**: Uygulamada kayıt **hep telefon (SMS OTP)** ile. E-posta sadece formda opsiyonel alan; kimlik telefon.

Yani “telefon ile kayıt olunca kullanıcı olmuyor” diye bir mantık yok; olursa sebep genelde **user_profiles**’ın hiç oluşmaması (sync hatası).

---

## Akışlar

### 1) Telefon ile kayıt (mobil – Supabase OTP)

1. Kullanıcı telefon girer → `signInWithOtp({ phone })` → SMS gelir.
2. OTP girer → `verifyOtp({ phone, token, type: 'sms' })` → `access_token` alınır.
3. Ad/soyad, şifre, tesis bilgileri (opsiyonel e-posta) ile **backend** `POST /auth/kayit/supabase-create` çağrılır (`access_token` ile).
4. Backend:
   - Supabase’ten kullanıcıyı doğrular,
   - **Prisma**’da tesis + kullanıcı oluşturur,
   - **ensureSupabaseBranchAndProfile(supabaseUser.id, kullanici, tesis)** çağırır.

5. **ensureSupabaseBranchAndProfile** → Supabase Edge Function **sync_branch_profile**’ı çağırır (Authorization: Bearer **SYNC_BRANCH_SECRET**).  
   Bu fonksiyon:
   - `branches` tablosuna tesis karşılığı branch’i yazar,
   - **user_profiles** tablosuna `user_id` + `branch_id` ile satır ekler/günceller.

Sonuç: Hem Prisma’da kullanıcı var hem Supabase’te `user_profiles` kaydı var; yani **telefon ile kayıt olan kullanıcı oluyor**.

**Eğer** `sync_branch_profile` çağrısı başarısız olursa (SYNC_BRANCH_SECRET yanlış/eksik, Edge deploy yok, ağ hatası):

- Prisma’da kullanıcı ve tesis oluşur,
- Supabase `user_profiles`’da kayıt **oluşmaz** → Sonraki isteklerde Supabase token ile API 401 verebilir (“kayıtlı hesap atıyor” hissi).

---

### 2) E-posta ile kayıt var mı?

- **Hayır.** Uygulamada **e-posta ile OTP** veya “sadece e-posta ile kayıt” akışı yok.
- Kayıt ekranında e-posta **opsiyonel** alan; asıl kimlik ve doğrulama **telefon (SMS OTP)**.
- Giriş de benzer: telefon + OTP veya (backend tarafında) telefon/e-posta + şifre.

Yani **telefon ile mail arasında “biri kullanıcı yapıyor biri yapmıyor” diye bir fark yok**; ikisi farklı kanal değil, kayıt tek kanal (telefon).

---

### 3) Telefon ile giriş (zaten kayıtlı)

- Kullanıcı telefon + OTP girer → `verifyOtp` → `access_token`.
- Mobil, backend’e `POST /auth/giris/otp-dogrula` body’de `access_token` gönderir.
- Backend:
  - Token ile Supabase’ten kullanıcıyı alır,
  - **Prisma**’da bu telefonu arar (`kullanici.findFirst({ where: { telefon } })`).
  - **Bulamazsa** → 404 “Bu telefon numarası ile kayıtlı kullanıcı bulunamadı”.
  - **Bulursa** → `ensureSupabaseBranchAndProfile` çağrılır (user_profiles/branch yoksa oluşturulur), sonra JWT + yanıt döner.

Yani girişte de “kullanıcı” (Prisma + user_profiles) aynı mantıkla korunuyor; giriş sırasında eksik profil varsa sync ile tamamlanıyor.

---

## Özet tablo

| Ne                          | Telefon ile kayıt | E-posta ile kayıt |
|-----------------------------|-------------------|-------------------|
| Böyle bir akış var mı?      | Evet (SMS OTP)    | Hayır             |
| Prisma kullanıcı oluşuyor mu? | Evet              | -                 |
| user_profiles oluşuyor mu?  | Evet (sync_branch_profile ile) | -   |
| Sync başarısız olursa       | user_profiles eksik kalır → 401 riski | - |

---

## “Telefon ile kayıt olan atılıyor” ise kontrol listesi

1. **Backend .env**  
   - `SYNC_BRANCH_SECRET` tanımlı mı?  
   - Supabase’te `sync_branch_profile` Edge Function’da aynı secret set mi?

2. **Supabase**  
   - `sync_branch_profile` deploy edilmiş mi?  
   - Loglarda bu fonksiyon 401/500 veriyor mu?

3. **user_profiles**  
   - Supabase Dashboard → `user_profiles` → bu kullanıcının `user_id` (auth.users.id) ile satır var mı, `branch_id` dolu mu?

4. **Backend log**  
   - `[supabaseSync] Edge Function hata` veya `[authTesisOrSupabase] Supabase user geçerli ama user_profiles kaydı yok` görünüyor mu?

Bu kontroller “telefon ile mail arasında fark var mı, telefon ile kayıt kullanıcı yapmıyor mu?” sorusunun cevabını netleştirir: Fark yok, telefon ile kayıt kullanıcı yapıyor; sorun genelde sync veya eksik user_profiles.
