# Doğrulama Maili Gelmiyor – "Error sending confirmation mail"

## Neden oluyor?

Doğrulama e-postaları **Supabase Auth** tarafından gönderilir (e-posta OTP, şifre sıfırlama, magic link vb.). Supabase’in **varsayılan** e-posta servisi:

- Sadece **proje ekibindeki** (Organization → Team) e-posta adreslerine mail atar
- **Saatte 2 mail** ile sınırlıdır
- Production için tasarlanmamıştır

Bu yüzden normal kullanıcı adreslerine mail giderken **"Error sending confirmation mail"** hatası alınır.

## Çözüm: Custom SMTP ayarlayın

Supabase projenizde kendi SMTP sunucunuzu tanımlamanız gerekir.

### 1. Supabase Dashboard

1. [Supabase Dashboard](https://supabase.com/dashboard) → projenizi seçin
2. **Authentication** → **Providers** veya **Settings** (sol menü)
3. **SMTP Settings** / **Custom SMTP** bölümüne gidin  
   (Doğrudan link: `https://supabase.com/dashboard/project/<PROJECT_REF>/auth/smtp`)

### 2. SMTP bilgilerini girin

Aşağıdaki alanları doldurun:

| Alan | Açıklama | Örnek |
|------|----------|--------|
| **Sender email** | Gönderen adres (From) | `no-reply@mykbs.com` veya Gmail adresiniz |
| **Sender name** | Gönderen adı | `MyKBS` |
| **Host** | SMTP sunucusu | `smtp.gmail.com` (Gmail) veya `smtp.sendgrid.net` vb. |
| **Port** | Port | `587` (TLS) veya `465` (SSL) |
| **Username** | SMTP kullanıcı adı | Gmail: e-posta adresiniz |
| **Password** | SMTP şifresi | Gmail: **Uygulama şifresi** (normal şifre değil) |

- **Gmail** kullanıyorsanız: [Google Hesap → Güvenlik → 2 Adımlı Doğrulama → Uygulama şifreleri](https://myaccount.google.com/apppasswords) ile bir “Uygulama şifresi” oluşturup bu şifreyi **Password** alanına yapıştırın.
- **SendGrid, Brevo, Resend, AWS SES** vb. kullanıyorsanız: İlgili servisin SMTP bilgilerini (host, port, kullanıcı, şifre) girin.

### 3. Kaydedin ve test edin

- **Enable Custom SMTP** (veya benzeri) kutusunu işaretleyin, **Save** deyin.
- Uygulama veya admin panelinden e-posta OTP veya “Şifre sıfırla” ile tekrar deneyin; doğrulama maili artık Custom SMTP üzerinden gidecektir.

### 4. Hâlâ gelmiyorsa

- **Spam** klasörünü kontrol edin
- Supabase **Auth → Logs** bölümünde ilgili hata mesajına bakın
- SMTP sağlayıcınızın (SendGrid, Gmail vb.) log/istatistik sayfasında mailin “delivered” / “bounced” durumunu kontrol edin
- Gönderen alan adı (örn. `mykbs.com`) için **SPF/DKIM/DMARC** kayıtları tanımlıysa maillerin spam’e düşme ihtimali azalır

## Projede nerede kullanılıyor?

- **E-posta OTP (kayıt/giriş):** `signInWithOtp({ email })` → Supabase doğrulama maili gönderir
- **Şifre sıfırlama:** `resetPasswordForEmail()` → Supabase sıfırlama linki gönderir

Bu maillerin hepsi Supabase Auth SMTP ayarından gider. Backend’deki `email.js` (Nodemailer) sadece tesis aktivasyonu vb. işler için kullanılır; Auth doğrulama mailleri **Supabase SMTP** ile gönderilir.

## Özet

| Sorun | Çözüm |
|-------|--------|
| Doğrulama maili gelmiyor / "Error sending confirmation mail" | Supabase Dashboard → Authentication → SMTP → Custom SMTP’yi açıp geçerli SMTP bilgilerini girin (Gmail uygulama şifresi veya SendGrid/Brevo/Resend vb.). |
