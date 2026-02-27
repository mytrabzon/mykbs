# KBS Backend Deploy (Railway / Render)

## Ortam değişkenleri (Railway Variables)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `PORT` | Hayır | Sunucu portu (Railway otomatik verir) |
| `SUPABASE_URL` | Evet | Supabase proje URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Supabase Settings → API → service_role key (mobilde ASLA kullanma). Adım adım: [docs/ADMIN_PANEL_SERVICE_ROLE.md](../docs/ADMIN_PANEL_SERVICE_ROLE.md) |
| `SYNC_BRANCH_SECRET` | Evet (OTP giriş için) | Rastgele uzun string; branch/profile sync için. Aynı değer Supabase Edge Function secret olarak da eklenmeli (`sync_branch_profile`) |
| `WORKER_SECRET` | Evet (cron için) | Rastgele uzun string; cron isteğinde header `x-worker-secret` ile gönderilir |
| `POLIS_KBS_URL` | Hayır | Polis KBS API base URL (boşsa mock) |
| `JANDARMA_KBS_URL` | Hayır | Jandarma KBS API base URL (boşsa mock) |
| `NODE_ENV` | Hayır | `production` |

## Railway

### Seçenek A: GitHub ile (otomatik deploy)
1. New Project → Deploy from GitHub Repo → repo seç.
2. **Root Directory:** Settings → Root Directory = `backend` (proje kökü değil, backend klasörü).
3. **Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SECRET` (uzun rastgele), isteğe `POLIS_KBS_URL`, `JANDARMA_KBS_URL`.
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

- **`npm warn config production Use --omit=dev instead`:** Proje kökünden deploy ediyorsanız root `postinstall` zaten production’da `--omit=dev` kullanıyor. Root Directory = `backend` ise Railway’de Build Command’ı `npm install --omit=dev` yaparak uyarıyı kaldırabilirsiniz.

## Sorun giderme

- **"Supabase yapılandırması eksik" (kayıt / giriş 500):** Railway Variables’da `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` (veya en azından `SUPABASE_ANON_KEY`) tanımlı olmalı. Ekledikten sonra redeploy edin.

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
   - **Build Command:** (boş bırakılabilir; Nixpacks varsayılanı `npm install` + `npm run build` veya sadece `npm install`).  
   - **Start Command:** `npm start` veya `node src/server.js` (package.json’daki `start` script’i).  
   - **PORT:** Sabit yazmayın; Railway `PORT` env ile verir. Backend zaten `process.env.PORT || 8080` kullanıyor.

4. **Mobil env:**  
   - `mobile/.env` ve EAS build env’de `EXPO_PUBLIC_BACKEND_URL=https://mykbs-production.up.railway.app` (sonda **slash yok**).  
   - Değiştirdikten sonra uygulamayı yeniden başlatın / yeni build alın.

## Health

- `GET /health` → `{ "ok": true, "status": "ok", "version": "1.0.0", "time": "..." }`
- Mobil "Bağlantıyı Test Et" bu adresi çağırır.

## Mock KBS

- `POLIS_KBS_URL` ve `JANDARMA_KBS_URL` boşsa otomatik mock (payload loglanır).
- Manuel: `POST /mock/kbs` body: `{ "test": true }`
