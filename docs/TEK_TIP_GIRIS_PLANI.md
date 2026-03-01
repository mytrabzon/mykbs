# Tek Tip Giriş ve Sorunsuz Giriş/Çıkış (Instagram/TikTok Tarzı)

Bu doküman, uygulamada **tek kaynak “giriş var mı”** kullanımını ve **“giriş yok” hatalarının** nasıl azaltıldığını özetler.

---

## 1. Tek kaynak: `isLoggedIn`

- **AuthContext** içinde artık **tek kaynak** kullanılıyor:
  - `isLoggedIn = !!(token || user)`  
  - Giriş yapılmış sayılması için **token** (backend JWT veya Supabase JWT) **veya** **user** yeterli.
- Ekranlarda “giriş yapılmamış” demek için **`getSupabaseToken()`** yerine **`isLoggedIn`** kullanın.
- Böylece tesis kodu + PIN ile giren kullanıcı “giriş yok” görmez; sadece Supabase gerektiren özelliklerde (topluluk, bildirimler) net mesaj verilir.

---

## 2. API token: `getApiToken()`

- API istekleri için kullanılan token (backend JWT veya Supabase JWT) **AuthContext**’teki `token` state’i ile aynı.
- “Token var mı?” sorusu için **`getApiToken()`** veya **`isLoggedIn`** kullanın; **sadece Supabase’e özel** işler için `getSupabaseToken()` kullanın (örn. Edge Functions: topluluk, bildirimler).

---

## 3. Ekranlarda yapılanlar

| Ekran | Değişiklik |
|-------|------------|
| **ProfilDuzenleScreen** | Giriş kontrolü `isLoggedIn`; backend yoksa ve Supabase token yoksa: “E-posta veya telefon ile giriş yaparak profil düzenleyebilirsiniz.” |
| **ToplulukScreen** | Giriş yoksa `!isLoggedIn` → “Giriş yapın.”; giriş var ama Supabase token yoksa → “Paylaşım için e-posta veya telefon ile giriş yapın.” |
| **PaylasimEkleScreen** | Token yoksa: `isLoggedIn` ise “Paylaşım için e-posta veya telefon ile giriş yapın.”, değilse “Giriş gerekli”. |
| **BildirimlerScreen** | “Giriş yapılmamış” kontrolü `!isLoggedIn`. |

---

## 4. Giriş yok hatalarını bitirmek için kurallar

1. **“Giriş gerekli” / “giriş yapın”** göstermeden önce **`isLoggedIn`** kontrol edin; `getSupabaseToken()` sadece Supabase’e özel özellikler için kullanılsın.
2. **Backend API** (profil, odalar, KBS vb.) için ekstra token kontrolü yapmayın; `api` zaten AuthContext’in token’ını kullanıyor. 401 gelirse genel “Oturum süresi doldu, tekrar giriş yapın” akışı yeterli.
3. **Supabase gerektiren özellikler** (topluluk, bildirimler): Token yoksa “Çıkış yapıp tekrar giriş yapın” yerine **“Bu özellik için e-posta veya telefon ile giriş yapın”** gibi net mesaj verin.

---

## 5. İsteğe bağlı: Tam tek tip giriş (sadece Supabase veya sadece backend)

- Şu an **iki tür** destekleniyor: backend JWT (tesis+PIN, e-posta/telefon+şifre, OTP) ve Supabase JWT. Detay: [GIRIS_TURLERI.md](./GIRIS_TURLERI.md).
- İleride **tek tip** yapmak isterseniz:
  - **Seçenek A:** Tüm girişi Supabase Auth’a taşıyıp backend’in sadece Supabase JWT kabul etmesi.
  - **Seçenek B:** Tesis+PIN’i kaldırıp sadece e-posta/telefon + şifre (backend veya Supabase) bırakmak.
- Bu adımlar ayrı bir migrasyon planı gerektirir; mevcut değişiklikler “tek kaynak isLoggedIn + net mesajlar” ile sorunsuz giriş/çıkış deneyimini iyileştirir.
