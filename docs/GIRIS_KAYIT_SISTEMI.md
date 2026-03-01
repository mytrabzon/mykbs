# Giriş / Kayıt Sistemi — Neden Hata Alınıyor, Nasıl Çalışıyor

## Tek cümleyle

**Telefon/e-posta + şifre ile giriş = backend (Node).** Token backend JWT’dir. Bu token artık **önce** backend’de doğrulanıyor; Supabase’e hiç gönderilmiyor. Böylece gereksiz hata ve gecikme yok.

---

## Nasıl çalışıyor?

| Giriş türü        | Nerede?   | Token tipi   | Kullanıldığı yer        |
|-------------------|-----------|-------------|-------------------------|
| Telefon + şifre   | Backend   | Backend JWT | Tüm /api/* istekleri    |
| E-posta + şifre   | Backend   | Backend JWT | Tüm /api/* istekleri    |
| Kod (OTP)         | Backend veya Supabase | Supabase veya Backend JWT | Backend önce kendi JWT’sini dener, yoksa Supabase |
| Tesis kodu + PIN  | Backend   | Backend JWT | Tüm /api/* istekleri    |

- **Backend URL** (EXPO_PUBLIC_BACKEND_URL) **varsa**: Kayıt ve giriş backend’e gider (`/api/auth/kayit`, `/api/auth/giris/yeni`). Alınan token **backend JWT**’dir.
- **Backend yoksa**: Giriş/kayıt Supabase Edge / OTP ile yapılır; token Supabase token’ı olur.

---

## Neden “telefon mail şifre girişleri hata alıyor” deniyordu?

1. **İki auth vardı:** Backend her istekte önce token’ı **Supabase**’e gönderiyordu. Telefon+şifre ile alınan token ise **backend JWT** olduğu için Supabase “imza geçersiz” diyordu. Sonra backend kendi JWT’sini doğruluyordu; yani giriş çalışıyordu ama loglar hata dolu ve akış kırılgan görünüyordu.
2. **Çözüm:** Artık backend **önce kendi JWT’sini** deniyor (payload’da `userId` + `tesisId` varsa). Eşleşirse Supabase’e hiç istek atılmıyor. Telefon/e-posta + şifre ile giren kullanıcılar tek adımda doğrulanıyor, hata log’u çıkmıyor.

---

## “Şifre ile giriş yapılamaz” / “Bu hesapta şifre tanımlı değil”

Veritabanında o kullanıcı için **şifre (hash) yoktur**. Örneğin sadece OTP ile kayıt olunduysa şifre set edilmemiş olabilir.

- **Ne yapılır:** “Kod ile giriş” kullanılır veya “Şifremi unuttum” ile şifre oluşturulur. Sonra telefon/e-posta + şifre ile giriş yapılabilir.
- **Yeni kayıtlar:** Uygulama “Kayıt ol” ekranından (şifre alanı dolu) kayıt yapıyorsa backend şifreyi kaydeder; bu kullanıcılar doğrudan şifre ile giriş yapabilir.

---

## Neden “basit değil, ufak hatalarda kitleniyor” deniyordu?

- Birden fazla giriş yolu (şifre, OTP, PIN) ve iki sistem (backend + Supabase) vardı; token her istekte önce Supabase’e gidiyordu.
- **Yapılan:** Backend JWT **ilk sırada** denendi. Telefon/e-posta + şifre ile girenler için tek tip akış: backend JWT alınır, her istekte sadece backend bu token’ı doğrular, Supabase’e gidilmez. Hata ve kilitlenme hissi azalır.

---

## Deploy

- `authTesisOrSupabase.js` değişti. Backend’i (Railway vb.) yeniden deploy et. Deploy edilmezse production’da eski davranış (önce Supabase denemesi) sürer.
