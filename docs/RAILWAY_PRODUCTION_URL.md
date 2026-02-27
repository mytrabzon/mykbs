# Railway production URL: https://mykbs-production.up.railway.app

Bu adres **canlı (production) backend**’inizin Railway’de yayında olduğu adrestir. Mobil uygulama, admin panel ve (isteğe bağlı) Supabase Edge Function’lar bu adrese istek atar.

---

## 1) Bu URL nedir?

- **Ne:** Railway’e deploy edilmiş **Node.js backend** (Express) servisinin public adresi.
- **Örnek:** `https://mykbs-production.up.railway.app`
- **Kural:** Sonda **slash (/) olmaz.** Doğru: `https://mykbs-production.up.railway.app` — Yanlış: `https://mykbs-production.up.railway.app/`

---

## 2) URL’i nereden alırsın?

1. [railway.app](https://railway.app) → Giriş yap.
2. **mykbs-production** (veya bu adresi veren) projesini aç.
3. Backend servisini seç (adresi `mykbs-production.up.railway.app` olan).
4. **Settings** → **Networking** / **Public Networking** → **Domain** kısmında görünen adres = production URL.

İlk kez domain yoksa **Generate domain** ile oluştur; Railway `https://<servis-adı>.up.railway.app` formatında verir.

---

## 3) Bu URL nerede kullanılır?

| Yer | Değişken / Ayar | Örnek |
|-----|------------------|--------|
| **Mobil (local .env)** | `EXPO_PUBLIC_BACKEND_URL` | `EXPO_PUBLIC_BACKEND_URL=https://mykbs-production.up.railway.app` |
| **Mobil (EAS build)** | `eas.json` → `build.*.env.EXPO_PUBLIC_BACKEND_URL` | Zaten `https://mykbs-production.up.railway.app` tanımlı (development/preview/production). |
| **Kök .env** | `EXPO_PUBLIC_BACKEND_URL` | Aynı URL (isteğe bağlı; mobil `mobile/.env` kullanıyorsa orası öncelikli). |
| **Admin panel (production)** | `NEXT_PUBLIC_API_URL` | `https://mykbs-production.up.railway.app/api` (API base = backend + `/api`). |
| **Prod repro script** | `BASE_URL` | `BASE_URL=https://mykbs-production.up.railway.app node backend/scripts/prod-repro.js` |
| **Supabase Edge (isteğe bağlı)** | Edge Function secret `BACKEND_URL` | OTP proxy vb. için; aynı URL. |

---

## 4) Nasıl “olacak” – adım adım

### Backend’i Railway’de yayına almak

1. **Railway’de proje + servis var mı?**  
   Yoksa: New Project → Deploy from GitHub (veya “Empty”) → Root Directory = `backend`.
2. **Variables** ekle: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SYNC_BRANCH_SECRET`, `WORKER_SECRET` (bkz. `backend/DEPLOY.md`).
3. Deploy: GitHub’dan otomatik veya `cd backend` → `railway link` → `npm run deploy` (veya `railway up`).
4. Deploy bittikten sonra **Settings → Networking**’den domain’i kopyala → bu senin production URL’in (örn. `https://mykbs-production.up.railway.app`).

### Mobil uygulamanın bu URL’i kullanması

1. **Geliştirme:** `mobile/.env` içinde:
   ```env
   EXPO_PUBLIC_BACKEND_URL=https://mykbs-production.up.railway.app
   ```
2. **EAS build (preview/production):** `mobile/eas.json` içinde ilgili profile’larda `EXPO_PUBLIC_BACKEND_URL` zaten bu URL; değiştirmen gerekmez.
3. Uygulama açıldığında `/health` ve `/api/*` istekleri bu adrese gider.

### Admin panelin bu URL’i kullanması

- Production build’de (örn. GitHub Pages / Vercel) `NEXT_PUBLIC_API_URL=https://mykbs-production.up.railway.app/api` olmalı (build-time env).
- Lokal test için `admin-panel/.env.local` içinde `NEXT_PUBLIC_API_URL=http://localhost:8080/api` kullanılabilir.

---

## 5) Hızlı kontrol

- Tarayıcıda aç: **https://mykbs-production.up.railway.app/health**  
  Beklenen: `{"ok":true,"status":"ok",...}` veya benzeri JSON.  
  Cevap yoksa: servis kapalı, domain yanlış veya Railway’de hata var (Logs’a bak).

---

## 6) Özet

| Soru | Cevap |
|------|--------|
| URL nereden geliyor? | Railway → Proje → Backend servisi → Settings → Networking → Domain. |
| Mobil nerede yazar? | `mobile/.env` → `EXPO_PUBLIC_BACKEND_URL`; EAS’ta `eas.json` env. |
| Admin panel? | Production’da `NEXT_PUBLIC_API_URL=https://mykbs-production.up.railway.app/api`. |
| Sonda slash? | Olmamalı. |
| Deploy nasıl? | GitHub push (varsa workflow) veya `cd backend` → `railway up` / `npm run deploy`. |

Detaylı deploy ve değişkenler: **`backend/DEPLOY.md`** ve **`docs/BACKEND_URL_NEREDEN.md`**.
