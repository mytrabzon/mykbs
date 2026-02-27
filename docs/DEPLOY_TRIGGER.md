# Deployları Tetikleme (Özelliklerin Canlıda Çalışması)

Bu dokümanda backend ve admin panel deploylarının nasıl yapıldığı ve tetiklenmesi özetlenir.

---

## 1. Otomatik deploy (GitHub Actions)

### Backend → Railway

- **Ne zaman:** `main` branch’e push (sadece `backend/**` değiştiğinde) veya Actions’tan **Run workflow**.
- **Gereken GitHub Secrets:**
  - `RAILWAY_TOKEN`: Railway Dashboard → Proje → **Settings** → **Tokens** → **New Token**
  - `RAILWAY_SERVICE_ID`: Aynı projede backend servisi → **Settings** → Service ID (veya URL’deki ID)

Secrets tanımlıysa: `main`’e (veya `backend/` içinde değişiklikle) push yapın; workflow **Deploy Backend to Railway** çalışır.

### Admin panel → GitHub Pages

- **Ne zaman:** `main` branch’e push veya Actions’tan **Run workflow**.
- **Gereken:** Repo **Settings** → **Pages** → **Source:** **GitHub Actions** seçili olmalı.

Push sonrası **Deploy to GitHub Pages** workflow’u admin paneli build edip Pages’e yükler. Build’de `NEXT_PUBLIC_API_URL` production backend’e ayarlı (`https://mykbs-production.up.railway.app/api`).

---

## 2. Deployları şimdi tetiklemek

### Seçenek A: Git push (önerilen)

```bash
git add .
git commit -m "Admin panel layout, MVP API, deploy ayarları"
git push origin main
```

- Backend’de değişiklik varsa **Deploy Backend to Railway** çalışır (RAILWAY_TOKEN + RAILWAY_SERVICE_ID tanımlıysa).
- **Deploy to GitHub Pages** her push’ta çalışır; admin panel yeniden build edilir ve yayına alınır.

### Seçenek B: Sadece workflow’ları manuel çalıştırma

1. GitHub repo → **Actions** sekmesi.
2. **Deploy Backend to Railway** → **Run workflow** → **Run workflow**.
3. **Deploy to GitHub Pages** → **Run workflow** → **Run workflow**.

---

## 3. Lokal Railway deploy (backend)

GitHub kullanmadan sadece backend’i deploy etmek için:

1. `backend/.env` içinde `RAILWAY_TOKEN` tanımlı olsun (Railway → Settings → Tokens).
2. İlk kez: `cd backend` → `railway login` → `railway link` (proje ve servis seçin).
3. Deploy: `cd backend` → `npm run deploy` veya `railway up --service <RAILWAY_SERVICE_ID>`.

---

## 4. Kontrol

- **Backend:** `https://mykbs-production.up.railway.app/health` → `{ "ok": true, ... }`
- **Admin panel:** GitHub Pages URL (örn. `https://<kullanici>.github.io/MYKBS/`) — repo adına göre base path: `/<repo-adı>/`

---

## 5. Yeni özellikler (Admin panel + app-admin API)

- Sidebar, komut paleti (Ctrl+K), kullanıcı listesi, audit, freeze/disable endpoint’leri backend’e eklendi.
- Backend deploy edildikten sonra `/api/app-admin/*` endpoint’leri canlıda çalışır.
- Admin panel deploy edildikten sonra yeni layout ve sayfalar GitHub Pages’te görünür; API istekleri `NEXT_PUBLIC_API_URL` ile production backend’e gider.
