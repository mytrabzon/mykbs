# Kayıt İşlemi – Akış ve Hata Noktaları

## Özet: İki farklı kayıt yolu

Uygulama **iki kanaldan** kayıt yapabiliyor:

1. **Supabase OTP** – SMS Supabase (Twilio) üzerinden gidiyorsa: mobil önce Supabase ile OTP doğrular, sonra backend’e `access_token` ile kayıt isteği atar.
2. **Backend OTP** – SMS backend üzerinden gidiyorsa: mobil backend’e “OTP iste” ve “OTP doğrula + kayıt” atar.

Hata, hangi yolu kullandığınıza ve hangi adımda koptuğuna göre değişir.

---

## 1. Adım: Telefon girilir, “Kod gönder” tıklanır

**Ekran:** `KayitScreen.js` → `handleOtpRequest()`

### A) Önce Supabase deneniyor

- `supabase.auth.signInWithOtp({ phone })` çağrılır.
- **Telefon formatı:** `formatPhoneForSupabase(telefon)` → `+90...` (E.164).
- Başarılı olursa: `usedSupabaseForKayit.current = true`, `lastSupabasePhoneRef.current = phone`, kullanıcı adım 2’ye (kod girişi) geçer.
- Hata olursa: log’a “Supabase OTP fallback” yazılır, **B)** yoluna düşer.

**Olası hatalar (A):**

- Supabase Auth’ta telefon provider kapalı / Twilio yanlış → SMS gitmez, hata döner.
- Rate limit / bot koruması → 403 veya benzeri.
- Ağ hatası → “SMS gönderilemedi” benzeri mesaj.

### B) Backend OTP (Supabase başarısızsa veya yoksa)

- `api.post('/auth/kayit/otp-iste', { telefon })` → **apiSupabase.ts** bunu `getBackendUrl()` varsa **Node backend**’e yönlendirir:  
  `POST {BACKEND_URL}/api/auth/kayit/otp-iste`
- Backend **auth.js** → `router.post('/kayit/otp-iste')`:
  - Telefon normalize edilir, “zaten kayıtlı” kontrolü.
  - OTP üretilir, Prisma `otp` tablosuna yazılır.
  - `smsService.sendOTP(telefon, otp)` ile SMS gönderilir.

**Olası hatalar (B):**

- `EXPO_PUBLIC_BACKEND_URL` yok → “Sunucu adresi eksik”.
- Backend 400: “Bu telefon numarası zaten kayıtlı” / “Geçersiz telefon”.
- Backend 500: “SMS gönderilemedi” (SMS servisi hata verirse).

---

## 2. Adım: 6 haneli kod girilir, “Kayıt ol” tıklanır

**Ekran:** `KayitScreen.js` → `handleKayit()`

### Yol 1: Supabase ile kayıt (`usedSupabaseForKayit.current === true`)

**2.1) OTP doğrulama (Supabase)**

- `supabase.auth.verifyOtp({ phone, token: otp.join(''), type: 'sms' })`  
  - `phone` = `lastSupabasePhoneRef.current || formatPhoneForSupabase(telefon)` (isteğe gönderilen ile aynı).
- Bu istek **doğrudan Supabase**’e gider: `POST https://...supabase.co/auth/v1/verify`.
- Başarılı olursa: `session.access_token` alınır.
- Hata: `verifyError` → Toast’ta “Kod geçersiz” veya “Kodun süresi doldu” (403 / otp_expired ise).

**Burada oluşan 403 / “otp_expired”:**

- Supabase’in döndüğü **gerçek süre dolumu** (kod birkaç dakika geçerlidir).
- Veya **telefon formatı** istek ile verify’da farklıysa (artık ref ile aynı kullanılıyor).
- Veya **rate limit / güvenlik** (ör. bot skoru) nedeniyle Supabase’in 403 vermesi.

**2.2) Backend’e kayıt isteği**

- `access_token` alındıktan sonra:  
  `api.post('/auth/kayit/supabase-create', { access_token, adSoyad, tesisAdi, ... })`
- **apiSupabase.ts** bunu **Node backend**’e yollar:  
  `POST {BACKEND_URL}/api/auth/kayit/supabase-create`
- Backend **auth.js** → `router.post('/kayit/supabase-create')`:
  - `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` (veya ANON) yoksa → **500** “Supabase yapılandırması eksik”.
  - `access_token` ile Supabase’e `GET .../auth/v1/user` → 401 ise “Doğrulama süresi doldu”.
  - Telefon Supabase user’dan alınır; “zaten kayıtlı” ise 400.
  - Prisma’da tesis + kullanıcı oluşturulur, `ensureSupabaseBranchAndProfile` (sync) çağrılır, JWT üretilir, cevap döner.

**Olası hatalar (2.2):**

- Backend’te **SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY** eksik (özellikle Railway) → 500 “Supabase yapılandırması eksik”.
- Token süresi dolmuş / geçersiz → 401 “Doğrulama süresi doldu”.
- Aynı telefon zaten kullanıcıda → 400 “Bu telefon numarası zaten kayıtlı”.
- Prisma / sync hatası → 500 “Kayıt tamamlanamadı”.

### Yol 2: Backend OTP ile kayıt (`usedSupabaseForKayit.current === false`)

- `api.post('/auth/kayit/dogrula', { telefon, otp, adSoyad, tesisAdi, sifre, sifreTekrar, ... })`  
  → **apiSupabase.ts** → `POST {BACKEND_URL}/api/auth/kayit/dogrula`
- Backend **auth.js** → `router.post('/kayit/dogrula')`:
  - Telefon normalize, OTP Prisma’da aranır (telefon + otp + islemTipi: 'kayit' + durum: 'beklemede' + expiresAt > now).
  - Bulunamazsa → 401 “Geçersiz veya süresi dolmuş OTP”.
  - Bulunursa OTP “doğrulandi” yapılır, tesis + kullanıcı oluşturulur, JWT döner.

**Olası hatalar:**

- OTP yanlış / süresi dolmuş / zaten kullanılmış → 401 “Geçersiz veya süresi dolmuş OTP”.
- Telefon formatı backend’de farklı normalize edilmişse eşleşmez → aynı 401.

---

## Hata nerede? Kontrol listesi

| Hata / Belirti | Muhtemel yer | Ne yapılır |
|----------------|--------------|------------|
| “Kodun süresi doldu” / 403 Supabase verify | Supabase `/auth/v1/verify` | Yeni kod iste, kısa sürede gir; telefon formatı ref ile aynı (zaten yapıldı). Supabase Dashboard: Phone provider, rate limit. |
| “Supabase yapılandırması eksik” (500) | Backend (Railway) | Railway Variables’a `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` ekle, redeploy. |
| “Doğrulama süresi doldu” (401 supabase-create) | Backend access_token doğrulama | Kullanıcı verify’dan hemen sonra “Kayıt ol”a bassın; token çok kısa süre geçerli. |
| “SMS gönderilemedi” | OTP iste (Supabase veya backend) | Supabase: Twilio/provider ayarı. Backend: smsService (SMS servisi) ve env. |
| “Bu telefon numarası zaten kayıtlı” | Backend kayıt / supabase-create | Giriş yapılmalı; kayıt değil. |
| “Sunucu adresi eksik” | Mobil | `EXPO_PUBLIC_BACKEND_URL` (backend URL) mobil .env’de tanımlı olmalı. |

---

## Akış özeti (Supabase OTP ile kayıt)

```
[Kullanıcı] Telefon gir → "Kod gönder"
    → KayitScreen: supabase.auth.signInWithOtp({ phone })
    → Supabase: SMS gönderir, OTP kaydeder
[Kullanıcı] Kodu girer → "Kayıt ol"
    → KayitScreen: supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    → Supabase: 200 + session.access_token  VEYA  403 otp_expired / diğer hata
    → Başarılıysa: api.post('/auth/kayit/supabase-create', { access_token, ... })
    → Backend: SUPABASE_URL + key kontrolü, access_token ile /auth/v1/user, tesis+kullanıcı oluştur, JWT döner
    → Mobil: loginWithToken(), kayıt tamamlandı
```

Bu dokümandaki adımlar ve hata noktaları, “kayıt işlemi nasıl oluyor ve neden hata veriyor?” sorusuna yanıt vermek içindir. Belirli bir hata mesajı veya log varsa, yukarıdaki tabloya göre ilgili satırı işaretleyip o adımı detaylı inceleyebilirsiniz.
