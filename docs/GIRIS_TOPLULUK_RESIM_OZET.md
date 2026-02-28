# Giriş, Topluluk ve Resim Paylaşımı Özeti

## MRZ kullanımı için giriş

MRZ (kimlik/pasaport okuma) için **herhangi bir giriş türü** yeterlidir; backend aynı token ile OCR ve okutulan belge kaydını kabul eder.

| Giriş türü | MRZ kullanılabilir mi? |
|------------|------------------------|
| **Tesis kodu + PIN** | Evet |
| **E-posta + şifre** | Evet |
| **Telefon + şifre** | Evet |
| **Telefon + OTP (kod)** | Evet |

**Koşullar:**

1. **Sunucu adresi (backend URL)** ayarlı olmalı (Ayarlar’da veya ilk girişte).
2. **Giriş yapılmış** olmalı (yukarıdaki yöntemlerden biriyle). Token (backend JWT veya Supabase JWT) backend’de `authenticateTesisOrSupabase` ile doğrulanır; OCR (`/ocr/mrz`, `/ocr/document`, `/ocr/document-base64`) ve okutulan belge kaydı (`/okutulan-belgeler`) bu token ile çalışır.

**İki MRZ akışı:**

- **Native MRZ (dev build, kamera):** Okuma cihazda yapılır, backend’e sadece “okutulan belge” kaydı gider; giriş gerekir.
- **Kamera ile çek / Galeriden seç:** Fotoğraf backend’e gönderilir, MRZ/OCR orada yapılır; **mutlaka** giriş + sunucu adresi gerekir.

Giriş yoksa veya sunucu adresi boşsa uygulama *"Backend bağlantısı ve giriş gerekli"* benzeri mesaj gösterir.

---

## Şifre ile giriş (e-posta + şifre, telefon + şifre)

- **Backend:** `POST /auth/giris/yeni` ile e-posta veya telefon + şifre doğrulanır; JWT + kullanıcı + tesis döner.
- **Supabase oturumu:** Aynı girişte mümkünse Supabase `signInWithPassword` çağrılır; alınan `access_token` mobilde saklanır ve Edge (topluluk, resim, profil) isteklerinde kullanılır.
- **Sonuç:** Topluluk listesi, resim paylaşımı ve profil işlemleri **token’a bağlı** çalışır; şifre ile girişte Supabase oturumu da açıldığı için bu özellikler kullanılabilir.

## Topluluk listesi – yazar bilgisi

- **Edge:** `community_post_list` her gönderi için `author_id` ile `user_profiles` tablosundan `display_name` ve `avatar_url` çeker.
- **Yanıt:** Her post objesi `author: { user_id, display_name, avatar_url }` ile gelir.
- **Mobil:** Topluluk ve post detay ekranlarında yazar adı ve profil resmi bu `author` bilgisiyle gösterilir.

## Resim paylaşımı

- **Akış:** Mevcut `upload_community_image` + `media.images` akışı aynı şekilde kullanılır.
- **Auth:** Giriş sorunu çözüldüğü için (Supabase oturumu şifre/OTP girişinde de açılıyor) resim paylaşımı token ile çalışır.

## Hata mesajları

- Topluluk / giriş / resim bağlamına göre **sadeleştirilmiş** mesajlar kullanılır (örn. Edge 401 → "Giriş gerekli", backend/network hataları bağlama uygun metinle).

## Not: Şifre ile girişte “giriş gerekli” devam ederse

- Bu hesabın **Supabase’te e-posta + şifre ile oluşturulmuş** olması ve **şifrenin aynı** olması gerekir.
- Sadece **OTP/telefon ile kayıt** olup şifre hiç set edilmemişse Supabase’te `signInWithPassword` başarısız olur; backend yine giriş yapar ama Supabase token alınamaz.
- Bu durumda:
  - Backend, şifre alanı boş kullanıcı için: *"Şifre ile giriş yapılamaz. Lütfen OTP ile giriş yapın."* döner.
  - Kullanıcıya **e-posta veya telefon ile (OTP) giriş** yapması önerilir; böylece Supabase oturumu da açılır ve topluluk/resim çalışır.
