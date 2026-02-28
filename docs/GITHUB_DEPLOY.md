# GitHub ile Deploy

## Mevcut workflow'lar

| Workflow | Tetikleyici | Ne yapar |
|----------|-------------|----------|
| **Deploy to GitHub Pages** (`.github/workflows/deploy.yml`) | `main` branch'e push, `admin-panel/**` veya workflow dosyası değişince | Admin paneli build edip GitHub Pages'e yükler |
| **Deploy Backend to Railway** (`.github/workflows/deploy-railway.yml`) | `main` branch'e push, `backend/**` değişince | Backend'i Railway'e deploy eder |

## Gerekli GitHub Secrets (Railway için)

Repo → **Settings** → **Secrets and variables** → **Actions**:

- `RAILWAY_TOKEN` — Railway hesabından alınan token
- `RAILWAY_SERVICE_ID` — Deploy edilecek backend servisinin ID'si

## Deploy tetiklemek

1. Değişiklikleri commit edin: `git add .` → `git commit -m "..."`.
2. GitHub'a push edin: `git push origin main`.
3. **Actions** sekmesinden workflow'ların çalıştığını kontrol edin.

- Sadece **backend** değiştiyse → Railway deploy çalışır.
- Sadece **admin-panel** değiştiyse → GitHub Pages deploy çalışır.
- İkisi de değiştiysa → Her iki workflow da çalışır.

## Manuel tetikleme

**Actions** → ilgili workflow (örn. "Deploy Backend to Railway") → **Run workflow** → **Run workflow**.
