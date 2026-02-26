# KBS Backend Deploy (Railway / Render)

## Ortam değişkenleri (Railway Variables)

| Değişken | Zorunlu | Açıklama |
|----------|---------|----------|
| `PORT` | Hayır | Sunucu portu (Railway otomatik verir) |
| `SUPABASE_URL` | Evet | Supabase proje URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Evet | Supabase Settings → API → service_role key (mobilde ASLA kullanma) |
| `SYNC_BRANCH_SECRET` | Evet (OTP giriş için) | Rastgele uzun string; branch/profile sync için. Aynı değer Supabase Edge Function secret olarak da eklenmeli (`sync_branch_profile`) |
| `WORKER_SECRET` | Evet (cron için) | Rastgele uzun string; cron isteğinde header `x-worker-secret` ile gönderilir |
| `POLIS_KBS_URL` | Hayır | Polis KBS API base URL (boşsa mock) |
| `JANDARMA_KBS_URL` | Hayır | Jandarma KBS API base URL (boşsa mock) |
| `NODE_ENV` | Hayır | `production` |

## Railway

1. New Project → Deploy from GitHub Repo → repo seç.
2. **Root Directory:** Settings → Root Directory = `backend` (proje kökü değil, backend klasörü).
3. **Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WORKER_SECRET` (uzun rastgele), isteğe `POLIS_KBS_URL`, `JANDARMA_KBS_URL`.
4. Deploy bitince **BACKEND_URL:** `https://<proje>.up.railway.app` (trailing slash yok).

## Railway Cron (KBS retry her 1 dk)

- Cron job ekle: her 1 dakikada bir:
  `curl -X POST https://<BACKEND_URL>/internal/kbs/worker -H "x-worker-secret: <WORKER_SECRET>"`
- Railway’de Cron servisi veya harici cron (cron-job.org vb.) kullanılabilir.

## Mobil

- `EXPO_PUBLIC_BACKEND_URL=https://<proje>.up.railway.app`
- Check-in / checkout istekleri backend’e; auth/login Supabase’e.

## Health

- `GET /health` → `{ "ok": true, "status": "ok", "version": "1.0.0", "time": "..." }`
- Mobil "Bağlantıyı Test Et" bu adresi çağırır.

## Mock KBS

- `POLIS_KBS_URL` ve `JANDARMA_KBS_URL` boşsa otomatik mock (payload loglanır).
- Manuel: `POST /mock/kbs` body: `{ "test": true }`
