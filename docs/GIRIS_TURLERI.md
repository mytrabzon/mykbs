# MYKBS – Giriş Türleri

Uygulama **iki ana giriş türü** kullanıyor. Backend her istekte gelen token’a bakıp hangi tür olduğunu anlıyor; profil, odalar, KBS vb. aynı API’lerle çalışıyor.

---

## 1) Hesap + şifre (e-posta veya telefon)

- **Ekranda:** Giriş sayfasında “Hesap” seçili → e-posta **veya** telefon + şifre.
- **Backend:** `POST /auth/giris/yeni` (e-posta) veya `POST /auth/giris/yeni` (telefon + şifre).
- **Token:** Backend JWT (bazen ek olarak Supabase token da döner).
- **Backend’de kimlik:** `authSource = 'prisma'` → kullanıcı Prisma `Kullanici` tablosundan, tesis bilgisi `Tesis` ile.
- **Profil:** Backend’de `Kullanici.displayName`, `Kullanici.title`, `Kullanici.avatarUrl` güncellenir (PATCH /profile).

Bu girişte **backend mutlaka açık** olmalı (EXPO_PUBLIC_BACKEND_URL). Supabase opsiyonel.

---

## 2) Tesis kodu + PIN

- **Ekranda:** Giriş sayfasında “Tesis kodu + PIN” → tesis kodu + PIN.
- **Backend:** `POST /auth/giris` (body: `tesisKodu`, `pin`).
- **Token:** Sadece backend JWT.
- **Backend’de kimlik:** Yine `authSource = 'prisma'` → `Kullanici` + `Tesis`.
- **Profil:** Yine backend PATCH /profile ile `Kullanici` alanları güncellenir.

Bu da **tamamen backend** ile çalışan giriş; Supabase token yoktur. Profil düzenleme backend JWT ile yapılır.

---

## 3) Kod ile giriş (SMS/e-posta OTP)

- **Ekranda:** “Kod ile giriş” → telefon veya e-posta → gelen kod.
- **Backend:** `POST /auth/giris/otp-iste` → `POST /auth/giris/otp-dogrula`.
- **Token:** Backend JWT.
- **Backend’de kimlik:** Yine `authSource = 'prisma'`.

Yani OTP ile giriş de **backend JWT** kullanır; tür 1 ve 2 ile aynı mantık.

---

## Supabase ne zaman devreye girer?

- **Kayıt / bazı akışlar:** Supabase Auth (e-posta doğrulama, Magic Link vb.) kullanılabiliyor.
- **Backend’e gelen istek:** Token önce **Supabase** ile doğrulanır; geçerli Supabase JWT ise `authSource = 'supabase'` olur, kullanıcı `user_profiles` + `branches` ile tanınır. Supabase JWT değilse (ör. backend JWT) **Legacy** kabul edilir → `authSource = 'prisma'`, Prisma `Kullanici` + `Tesis`.

Yani:
- **Tesis kodu + PIN** veya **telefon/e-posta + şifre** ile giriş → backend JWT → `prisma`.
- **Supabase ile kayıt olup** Supabase JWT ile gelen istek → `supabase`.

---

## Özet tablo

| Giriş türü        | Token tipi    | Backend authSource | Profil nerede?        |
|-------------------|---------------|--------------------|------------------------|
| Tesis kodu + PIN  | Backend JWT   | prisma             | Prisma Kullanici       |
| E-posta/telefon + şifre | Backend JWT   | prisma             | Prisma Kullanici       |
| Kod ile giriş (OTP) | Backend JWT   | prisma             | Prisma Kullanici       |
| Supabase Auth (Edge/kayıt) | Supabase JWT | supabase           | Supabase user_profiles |

İki tür = **Backend (Prisma)** ve **Supabase**. Uygulama her iki token’ı da kabul ediyor; backend hangi token’ın geldiğine göre `authSource` ve ilgili tabloları seçiyor.
