# E-posta Kodları Neden Gönderilmiyor? Kontrol Listesi

Kod ile giriş veya şifremi unuttum ekranında "Kod Gönder"e basıldığında e-posta gelmiyorsa aşağıdakileri sırayla kontrol edin.

## 1. Supabase Custom SMTP (En sık neden)

E-posta OTP **Supabase Auth** tarafından gönderilir. Varsayılan ayarlar:

- Sadece **proje ekibindeki** (Organization → Team) e-posta adreslerine mail atar
- **Saatte 2 mail** ile sınırlıdır
- Diğer adreslere "Error sending confirmation mail" veya "Email address not authorized" hatası verir

**Yapılacak:**

1. [Supabase Dashboard](https://supabase.com/dashboard) → projenizi seçin
2. **Authentication** → **SMTP Settings** (veya **Providers** altında)
3. **Custom SMTP** bölümünü açın ve geçerli SMTP bilgilerini girin:
   - **Sender email**: Gönderen adres (örn. `no-reply@mykbs.com` veya Gmail adresiniz)
   - **Sender name**: Örn. "KBS Prime"
   - **Host / Port / Username / Password**: Gmail için `smtp.gmail.com`, port `587`, e-posta + [Uygulama şifresi](https://myaccount.google.com/apppasswords). SendGrid, Brevo, Resend vb. kullanılabilir.
4. **Save** ile kaydedin.

Detay: `docs/SUPABASE_DOGRULAMA_MAILI_HATASI.md`

---

## 2. Auth Logs’ta hata var mı?

Mail hiç çıkmıyorsa veya SMTP hatası alıyorsanız:

1. Dashboard → **Logs** → **Auth Logs**
2. "Kod Gönder"e bastığınız zamana denk gelen log satırına bakın
3. Orada görünen hata:
   - **"Error sending confirmation mail"** → SMTP yanlış / kapalı (yukarıdaki SMTP adımlarını yapın)
   - **"Email address not authorized"** → Custom SMTP yok veya sadece ekibe mail gidiyor
   - **Rate limit** → Saatlik limit aşıldı (Custom SMTP’de genelde daha yüksek limit olur)

---

## 3. Uygulama tarafında hata mesajı

Geliştirme sırasında Metro/console’da şu log çıkıyor olabilir:

- `[Login] signInWithOtp error: ...`
- `[ForgotPassword] signInWithOtp error: ...`
- `OTPVerify signInWithOtp email error ...`

Bu satırlardaki **error.message** ve **error.code** Supabase’in döndürdüğü hatadır. Birebir mesajı Auth Logs ile eşleştirip SMTP / rate limit / yetki durumunu anlayabilirsiniz.

Kullanıcıya gösterilen mesajlar da buna göre:
- "E-posta servisi yapılandırılmamış" → Custom SMTP kurulmamış veya hatalı
- "Bu e-posta adresiyle kod gönderilemiyor" → "authorized" / "not allowed" benzeri hata (genelde SMTP/ekip kısıtı)

---

## 4. E-posta şablonu ve rate limit

- **Authentication** → **Email Templates** → **Magic Link** (veya OTP e-postası kullanan şablon): İçerik ve dil doğru mu kontrol edin.
- Dashboard’da **Auth** veya **Settings** altında **Rate limits** varsa, e-posta OTP limitini kontrol edin; çok düşükse artırın veya Custom SMTP ile limitleri aşmayın.

---

## 5. Spam / teslim

SMTP ve Auth Logs’ta hata yok ama kullanıcı mail almıyorsa:

- **Spam / Gereksiz** klasörüne bakılsın
- Gönderen alan adı için **SPF/DKIM/DMARC** (özellikle kendi domain kullanıyorsanız) tanımlı olsun
- SMTP sağlayıcısının (SendGrid, Gmail vb.) panelinde teslim / bounce raporlarına bakın

---

## Özet tablo

| Belirti | Olası neden | Yapılacak |
|--------|-------------|-----------|
| "Kod gönderilemedi" + console’da signInWithOtp error | SMTP kapalı / hatalı veya yetki | Custom SMTP kurun, Auth Logs’u kontrol edin |
| "Error sending confirmation mail" | SMTP yapılandırılmamış veya bilgiler yanlış | SMTP Settings’i düzeltin, Gmail ise Uygulama şifresi kullanın |
| "Email address not authorized" | Varsayılan mailer, sadece ekibe gidiyor | Custom SMTP açın |
| Hiç hata yok, mail yok | Spam / SMTP teslim sorunu | Spam klasörü, SPF/DKIM, sağlayıcı logları |
| Rate limit hatası | Çok istek | Custom SMTP ile limit artar; gerekirse limit ayarını kontrol edin |

Projede e-posta OTP kullanan yerler: **LoginScreen** (Kod ile giriş), **ForgotPasswordScreen**, **OTPVerifyScreen**. Hepsi `supabase.auth.signInWithOtp({ email, options })` kullanır; mailler tamamen **Supabase Auth SMTP** ayarından gider.
