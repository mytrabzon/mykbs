# Supabase: Profil E-posta Bağlama – Mail Gelmiyor / SMTP Kontrol Listesi

Profil ekranında "E-posta bağla" veya "E-posta değiştir" kullandığınızda doğrulama **e-postası Supabase Auth** tarafından gönderilir. Kod/link gelmiyorsa aşağıdakileri kontrol edin.

## 1. Custom SMTP Açık mı?

- **Supabase Dashboard** → projeniz → **Authentication** → **SMTP Settings**
- **Custom SMTP** etkin ve alanlar dolu olmalı:
  - **Sender email** (From): Örn. `no-reply@yourdomain.com` — SMTP hesabınızda tanımlı bir adres olmalı
  - **Sender name**: Örn. "KBS Prime"
  - **Host, Port, User, Password**: Sağlayıcınıza göre (Gmail, SendGrid, Brevo, Resend, Mailtrap vb.)

Varsayılan Supabase e-postası **sadece proje ekibindeki e-posta adreslerine** mail gönderir; diğer adreslere "Email address not authorized" hatası verir.

## 2. E-posta Değişikliği İçin Ayar

E-posta değiştirme / bağlama için Supabase’in **email change** akışını kullanıyoruz. Bu akışın çalışması için:

- **Dashboard** → **Authentication** → **Auth Settings** (veya **Configuration**)
- `mailer_secure_email_change_enabled` **true** olmalı (genelde custom SMTP açıldığında etkindir; yoksa Management API ile ayarlanabilir).

## 3. E-posta Şablonu

- **Authentication** → **Email Templates**
- **"Change Email Address"** (veya "Confirm email change") şablonunu kontrol edin:
  - Alıcı yeni e-posta olmalı (Supabase genelde `{{ .NewEmail }}` kullanır)
  - **Redirect URL** / **Site URL**: Uygulamanızın deep link veya web URL’i doğru olmalı; yanlışsa link tıklanınca hata alırsınız

## 4. Auth Logs (Hata Nerede?)

- **Dashboard** → **Logs** → **Auth Logs**
- "E-posta bağla" denediğiniz andaki log satırına bakın:
  - **SMTP / handover hataları**: Host, port, kullanıcı, şifre veya "From" adresi yanlış
  - **"Email address not authorized"**: Custom SMTP yok veya adres ekibe kapalı
  - **Rate limit**: Saatlik limit aşıldı (custom SMTP’de genelde 30/saat)

Bu log, mailin "hiç gönderilmediği" mi yoksa "gönderilip ulaşmadığı" mı ayırt etmenizi sağlar.

## 5. Sık Nedenler

| Belirti | Olası neden | Yapılacak |
|--------|-------------|-----------|
| "Email address not authorized" | Varsayılan mailer, adres ekibe kapalı | Custom SMTP kurun veya adresi ekibe ekleyin |
| Hiç hata yok ama mail yok | SMTP yanlış / spam / suppression list | Auth Logs’ta SMTP hatası var mı bakın; Mailtrap vb. ile test edin |
| From adresi reddediliyor | SMTP sağlayıcı "From" ile gönderim izni istiyor | Sender email’i SMTP hesabındaki doğrulanmış adres yapın |
| Link tıklanınca hata | Yanlış Site URL / Redirect | Email template’teki URL’leri düzeltin |

## 6. Test İçin

- **Mailtrap**, **Mailhog** gibi bir sandbox kullanın: SMTP’yi buna yönlendirip mailin Supabase’ten çıkıp çıkmadığını görün.
- Gmail kullanıyorsanız: Uygulama şifresi (App Password) kullanın; "Daha az güvenli uygulama" kapalıysa normal şifre çalışmaz.

## Özet

1. **Custom SMTP** açık ve doğru yapılandırılmış mı?
2. **mailer_secure_email_change_enabled** (e-posta değişikliği) etkin mi?
3. **Auth Logs**’ta ilgili istekte hata var mı?
4. **Email Templates** → Change Email şablonu ve **Redirect/Site URL** doğru mu?

Bu dört adımı kontrol ettikten sonra hâlâ mail gelmiyorsa, Auth Logs’taki tam hata mesajı ile birlikte Supabase destek veya dokümanlara bakabilirsiniz.
