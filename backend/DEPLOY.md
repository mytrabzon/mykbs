# KBS Backend Deploy (Railway / Render)

## Ortam değişkenleri (Railway Variables)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `PORT` | Hayır | Sunucu portu (Railway otomatik verir) |
| `JWT_SECRET` | **Evet (production)** | JWT token imzası. Yoksa uygulama başlamaz (`[server] Production ortamında JWT_SECRET zorunludur`). En az 32 karakter; örn. `openssl rand -base64 32` ile üretin. **Railway Variables** (veya kullandığınız platformun env) içine ekleyin. |
| `DATABASE_URL` | **Evet (Railway)** | Supabase PostgreSQL: Dashboard → **Settings → Database** → Connection string → **URI**. Örnek: `postgresql://postgres:[ŞİFRE]@db.xxxx.supabase.co:5432/postgres`. Railway Variables'a ekleyin; ilk deploy sonrası (veya deploy script'te) `npx prisma db push` çalıştırın. |
| `SUPABASE_URL` | Evet | Supabase proje URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Supabase Settings → API → service_role key (mobilde ASLA kullanma). Adım adım: [docs/ADMIN_PANEL_SERVICE_ROLE.md](../docs/ADMIN_PANEL_SERVICE_ROLE.md) |
| `SYNC_BRANCH_SECRET` | Evet (OTP giriş için) | Rastgele uzun string; branch/profile sync için. Aynı değer Supabase Edge Function secret olarak da eklenmeli (`sync_branch_profile`) |
| `WORKER_SECRET` | Evet (cron için) | Rastgele uzun string; cron isteğinde header `x-worker-secret` ile gönderilir |
| `POLIS_KBS_URL` | Hayır | Polis KBS API base URL (boşsa mock) |
| `JANDARMA_KBS_URL` | Hayır | Jandarma KBS API base URL (boşsa mock) |
| `NODE_ENV` | Hayır | `production` |

## Railway

### Supabase PostgreSQL (DATABASE_URL)
- Supabase Dashboard → **Settings** → **Database** → **Connection string** → **URI** kopyalayın.
- **Port 5432** (direct) sadece IPv6 destekler; "P1001: Can't reach" alıyorsan **port 6543** (Supavisor) kullanın:  
  `postgresql://postgres:[ŞİFRE]@db.xxxx.supabase.co:6543/postgres?sslmode=require&pgbouncer=true`
- **Railway Variables** içine `DATABASE_URL` olarak ekleyin.
- Tabloları oluşturmak için bir kez: `cd backend && npx prisma db push`
- **Hâlâ P1001:** Proje paused olabilir → Dashboard’da **Restore project**. Veya Connect → **Session mode** (pooler) URI’sini kopyalayıp deneyin.

### Seçenek A: GitHub ile (otomatik deploy)
1. New Project → Deploy from GitHub Repo → repo seç.
2. **Root Directory:** Settings → Root Directory = `backend` (proje kökü değil, backend klasörü).
3. **Variables:** `DATABASE_URL` (Supabase Postgres URI), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SECRET` (uzun rastgele), isteğe `POLIS_KBS_URL`, `JANDARMA_KBS_URL`.
4. Deploy bitince **BACKEND_URL:** `https://<proje>.up.railway.app` (trailing slash yok). Her push’ta otomatik deploy.

### Seçenek B: CLI ile deploy
1. Railway CLI: `npm i -g @railway/cli` veya `npx -y @railway/cli` kullan.
2. **İlk kez:** `cd backend` → `railway login` (tarayıcı açılır, giriş yap).
3. Proje bağlı değilse: `railway link` ile proje/servis seç.
4. Deploy: `npm run deploy` veya `railway up` (backend klasöründen).
5. CI için: `RAILWAY_TOKEN=<token> railway up -d` (token: Railway Dashboard → Project → Settings → Tokens).

### Seçenek C: GitHub Actions ile otomatik deploy (önerilen)
`main` branch’e push yapıldığında backend otomatik olarak Railway’e deploy edilir (sadece `backend/**` değiştiğinde).

**Kurulum (bir kez):**
1. **Railway Project Token:** Railway → Projen → **Settings** → **Tokens** → **New Token** → oluştur, token’ı kopyala (bir kez gösterilir).
2. **Service ID:** Railway’de backend servisine tıkla → **Settings** → sayfadaki veya URL’deki service id’yi kopyala (örn. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
3. **GitHub Secrets:** Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** ile ekle:
   - `RAILWAY_TOKEN` = Railway’den kopyaladığın token
   - `RAILWAY_SERVICE_ID` = Backend servisinin ID’si

Bundan sonra `main`’e (veya `backend/` altında değişiklik içeren) push’larda deploy otomatik çalışır. Workflow: `.github/workflows/deploy-railway.yml`.

## Railway Cron (KBS retry her 1 dk)

- Cron job ekle: her 1 dakikada bir:
  `curl -X POST https://<BACKEND_URL>/internal/kbs/worker -H "x-worker-secret: <WORKER_SECRET>"`
- Railway’de Cron servisi veya harici cron (cron-job.org vb.) kullanılabilir.

## Mobil

- `EXPO_PUBLIC_BACKEND_URL=https://<proje>.up.railway.app`
- Check-in / checkout istekleri backend’e; auth/login Supabase’e.

## Build / npm uyarıları

- **`npm warn config production Use --omit=dev instead`:** `backend/railway.json` içinde build command zaten `npm install --omit=dev` olarak tanımlı; Root Directory = `backend` ise bu dosya kullanılır ve uyarı kaybolur. Manuel ayarlıyorsanız Build Command = `npm install --omit=dev` yapın.
- **`(node) [DEP0040] DeprecationWarning: The punycode module is deprecated`:** Bağımlılıklardan (örn. nodemailer) gelir. `backend/package.json` içinde `overrides.punycode` ile userland paketi kullanılır; hâlâ görürseniz Railway’de **Variables**’a `NODE_OPTIONS=--no-deprecation` ekleyin veya Docker deploy kullanın (Dockerfile’da bu ayar var).

## Sorun giderme

- **"[server] Production ortamında JWT_SECRET zorunludur" / container sürekli yeniden başlıyor:** Deploy platformunda (Railway Variables, Render env, vb.) `JWT_SECRET` tanımlı değil. Değeri ekleyin (en az 32 karakter; örn. `openssl rand -base64 32` ile üretin), kaydedin ve redeploy edin.
- **"Supabase yapılandırması eksik" (kayıt / giriş 500):** Railway Variables’da `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` (veya en azından `SUPABASE_ANON_KEY`) tanımlı olmalı. Ekledikten sonra redeploy edin.

### "Veritabanı hatası" / "Can't reach database server" (Supabase paused)

Railway loglarında `Can't reach database server at db.xxxx.supabase.co:6543` görüyorsan, backend’in **Supabase Postgres**’e bağlanamadığı anlamına gelir. **Development kullanman bunun sebebi değildir**; hata sunucu tarafında.

**En sık sebep: Supabase projesi uykuya alınmış (paused).** Ücretsiz planda 7 gün kullanım yoksa proje otomatik duraklar.

**Yapman gerekenler:**
1. [Supabase Dashboard](https://supabase.com/dashboard) → projeni aç (iuxnpxszfvyrdifchwvr).
2. Ana sayfada **"Project paused"** / **"Proje duraklatıldı"** yazıyorsa **"Restore project"** / **"Projeyi geri yükle"** butonuna tıkla.
3. Birkaç dakika bekle; tamamlanınca e-posta gelebilir.
4. Sonra mobil uygulamada tekrar dene (Odalar / tesis verisi).

Hâlâ bağlanamıyorsa: Supabase → **Settings → Database** → Connection string’i kontrol et; **Session mode (port 6543)** kullanıyorsan Railway’deki `DATABASE_URL` aynı URI olmalı. Proje aktif mi Dashboard’dan kontrol et.

### "MaxClientsInSessionMode: max clients reached" / pool bağlantı limiti

Supabase **Session mode** pooler’da eşzamanlı bağlantı sayısı sınırlıdır. Prisma çok bağlantı açarsa bu hata log’da görünür. Backend, pooler URL’si kullanıyorsa otomatik olarak `connection_limit (varsayılan 3; DATABASE_POOL_SIZE ile değiştirilebilir). "Timed out fetching a new connection" için URL'de connection_limit=1 kullanmayın` ekler (tek bağlantı ile pool limiti aşılmaz). Railway’de `DATABASE_URL`’i pooler (port 6543 veya `pooler.supabase.com`) ile verirsen ek bir ayar gerekmez; yoksa URL’ye `?connection_limit (varsayılan 3; DATABASE_POOL_SIZE ile değiştirilebilir). "Timed out fetching a new connection" için URL'de connection_limit=1 kullanmayın` ekleyebilirsin.

### "Backend Bağlantı Hatası" / "Sunucu adresi doğrulanamadı" / "Bilgi alınamadı"

Mobil uygulama `EXPO_PUBLIC_BACKEND_URL` ile `/health` adresine istek atar. Cevap gelmezse bu ekran görünür. Adım adım kontrol:

1. **Railway’de servis çalışıyor mu?**  
   Railway Dashboard → Proje → Backend servisi → **Deployments**. Status **Running** olmalı. Failed/Crashed ise **Logs** sekmesinden hata mesajına bakın.

2. **Tarayıcıdan /health testi:**  
   Telefon veya bilgisayar tarayıcısında açın:  
   `https://mykbs-production.up.railway.app/health`  
   - **Cevap yok / sayfa açılmıyor:** Backend kapalı, uyuyor veya domain yanlış. Railway → Settings → **Networking** / **Public URL** kısmından gerçek URL’yi kopyalayın; mobil `EXPO_PUBLIC_BACKEND_URL` ve EAS env’de bu URL (sonda `/` olmadan) kullanılmalı.  
   - **404:** Backend’te `GET /health` route’u yok (bu projede var; deploy eski olabilir → yeniden deploy).  
   - **500:** Backend çöküyor; Railway **Logs**’a bakın.  
   - **`{"ok":true,"status":"ok",...}`:** Backend sağlam; sorun mobil tarafta (URL yanlış, farklı build, cache).

3. **Railway ayarları:**  
   - **Root Directory:** `backend` (repo kökü değil).  
   - **Build Command:** Boş bırakılırsa `backend/railway.json` kullanılır (`npm install --omit=dev`). Manuel: `npm install --omit=dev`.
   - **Start Command:** `npm start` veya `node src/server.js`. Deprecation log’larını kapatmak için: `NODE_OPTIONS=--no-deprecation node src/server.js` veya Variables’da `NODE_OPTIONS=--no-deprecation`. Migration’ı her deploy’da çalıştırmak istersen: `npm run migrate:deploy && npm start` (Prisma tabloları güncel kalır).  
   - **PORT:** Sabit yazmayın; Railway `PORT` env ile verir. Backend zaten `process.env.PORT || 8080` kullanıyor.  
   - **Teşhis:** `GET /health` → backend ayakta; `GET /health/db` → veritabanı bağlantısı. Log’da `[Startup] DATABASE_URL: host=... db=...` ile env kontrol edilir.

4. **Mobil env:**  
   - `mobile/.env` ve EAS build env’de `EXPO_PUBLIC_BACKEND_URL=https://mykbs-production.up.railway.app` (sonda **slash yok**).  
   - Değiştirdikten sonra uygulamayı yeniden başlatın / yeni build alın.

## Health

- `GET /health` → `{ "ok": true, "status": "ok", "version": "1.0.0", "time": "..." }`
- Mobil "Bağlantıyı Test Et" bu adresi çağırır.

## Mock KBS

- `POLIS_KBS_URL` ve `JANDARMA_KBS_URL` boşsa otomatik mock (payload loglanır).
- Manuel: `POST /mock/kbs` body: `{ "test": true }`
