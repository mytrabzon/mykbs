# Yeni Kayıt Sistemi

## Özet

Kayıt tek adımda yapılır: **Ad soyad**, **telefon**, **e-posta**, **şifre**, **otel/tesis adı**, **oda sayısı**, **ortalama bildirim**. OTP veya e-posta doğrulama adımı yok. Kayıt olan kullanıcı hemen uygulamayı kullanabilir.

## Backend

- **Endpoint:** `POST /api/auth/kayit`
- **Body (zorunlu):** `adSoyad`, `telefon`, `email`, `sifre`, `sifreTekrar`, `tesisAdi`, `odaSayisi`
- **Body (opsiyonel):** `ortalamaBildirim` (varsayılan 100, 50–10000 arası), `il`, `ilce`, `adres`, `tesisTuru`
- **Sonuç:** Tesis + Kullanıcı (sahip) oluşturulur, `durum: 'aktif'`. JWT `token`, `kullanici`, `tesis` döner.

## Giriş

- **E-posta + şifre:** `POST /api/auth/giris/yeni` → `{ email, sifre }`
- **Telefon + şifre:** `POST /api/auth/giris/yeni` → `{ telefon, sifre }`

Mobil uygulama artık e-posta ile girişte de backend kullanır (Supabase değil).

## KBS (Kimlik Bildirim Sistemi)

Kayıt sonrası KBS kullanmak için kullanıcı **Ayarlar** → KBS Ayarları bölümünden **tesis kodu** ve **KBS web servis şifresi**ni girip onaya gönderir. Sistem zaten mevcut (talep + admin onayı).

## SQL

Mevcut şema kullanılır; ek migration gerekmez. Tablolar:

- `Tesis`: tesisAdi, yetkiliAdSoyad, telefon, email, il, ilce, adres, odaSayisi, tesisTuru, tesisKodu, durum, paket, kota, …
- `Kullanici`: tesisId, adSoyad, telefon, email, sifre, rol (sahip), …

Eski OTP kayıt route’ları (`/kayit/otp-iste`, `/kayit/dogrula`, `/kayit/supabase-verify-otp`, `/kayit/supabase-create`) kodda duruyor ama mobil uygulama artık sadece `POST /auth/kayit` kullanıyor.
