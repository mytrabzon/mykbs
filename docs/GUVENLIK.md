# MYKBS — Güvenlik (Secrets)

## Asla paylaşma / git'e koyma

- **SUPABASE_SERVICE_ROLE_KEY** — Supabase’e tam yetki verir. Sadece backend sunucusunda (ve `.env` içinde) olmalı. Mobil / frontend’e **asla** yazma.
- **JWT_SECRET** — Token üretmek için. Sızdığında herkes sahte oturum açabilir.
- **KBS_SECRET_KEY** — KBS şifrelerini şifrelemek için. İsteğe bağlı; yoksa JWT_SECRET kullanılır.
- **RAILWAY_TOKEN** — Railway deploy için. Sadece kendi makinen veya CI’da kullan.
- **ADMIN_SECRET**, **SYNC_BRANCH_SECRET** — Sadece backend / güvenilir ortamda.

## Zaten yapılanlar

- `backend/.env`, `mobile/.env`, `.env` **.gitignore** içinde — bu dosyalar git’e commit edilmez.
- Secret’lar kodda **console.log** veya response’ta **gösterilmiyor**; sadece `process.env` ile okunuyor.

## Senin yapman gerekenler

1. **`.env` dosyalarını** asla public repo’ya pushlama. (Private repo’da bile `.gitignore` sayesinde zaten git’e girmiyor.)
2. **Supabase Dashboard** → Settings → API’de service_role key’i gerektiğinde **rotate** et (yeni key üret, eskiyi kaldır); sonra backend `.env`’i güncelle.
3. Key’ler bir yere sızdıysa: hemen Supabase’te ilgili key’i iptal et, yeni key üret, backend’i yeni key ile güncelle.

## Railway / production

Production’da secret’ları **Railway Dashboard → Variables** (veya benzeri) üzerinden ver; `.env` dosyasını sunucuya yükleme. Her ortam için ayrı key’ler kullan (production için ayrı JWT_SECRET, vs.).
