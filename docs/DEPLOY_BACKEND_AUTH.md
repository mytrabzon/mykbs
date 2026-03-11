# Backend Auth + KBS Credentials — Deploy Özeti

## Yapılanlar

### 1. Supabase (tamamlandı)
- **Migration repair**: 0001–0011 uzak veritabanında zaten uyguluydu; `supabase migration repair 0001 ... 0011 --status applied --linked` ile işlendi.
- **0012 push**: `supabase db push --linked` ile **0012_backend_auth_kbs_credentials.sql** uzak DB’ye uygulandı.
- Tablolar: `facility_credentials_requests`, `facility_credentials`, `app_users`, `app_roles`, `push_registrations` ve RLS policy’ler hazır.

### 2. Backend (senin yapacakların)

#### A) Railway deploy (production)
1. **Railway token**: Railway Dashboard → proje → Settings → Tokens → **Generate Project Token**
2. **backend/.env** (veya proje kökü .env) içine ekle:
   ```env
   RAILWAY_TOKEN=<üretilen_token>
   ```
3. Backend klasöründen deploy:
   ```bash
   cd backend
   npm run deploy
   ```
4. Railway’da backend servisinin **Environment** kısmında şunların tanımlı olduğundan emin ol:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (push + KBS credentials için gerekli)
   - `JWT_SECRET` — **Zorunlu:** production’da yoksa uygulama başlamaz (`[server] Production ortamında JWT_SECRET zorunludur`).
   - İsteğe bağlı: `ADMIN_KULLANICI_ID`, `KBS_SECRET_KEY`

#### A2) Container / Supabase vb. (Docker veya platform)
Container veya Supabase ile backend çalıştırıyorsan `.env` dosyası image’a kopyalanmaz. **JWT_SECRET**’ı mutlaka platform ortam değişkeni olarak ver:
- **Supabase:** Project Settings → Edge Functions → Secrets (veya ilgili servis env)
- **Diğer (Railway, Render, Fly.io vb.):** Servis → Variables / Environment
Ayrıca `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` tanımlı olmalı.

**Not:** Build sırasında `npm warn config production Use --omit=dev instead` uyarısı alırsan, platform `npm install --production` kullanıyordur. Build komutunu `npm ci --omit=dev` veya `npm install --omit=dev` olacak şekilde değiştirirsen uyarı gider.

#### B) Yerel backend (geliştirme)
Yeni route’ların çalışması için backend’i yeniden başlat:
```bash
cd backend
npm run dev
```
veya çalışan Node sürecini durdurup tekrar `npm start` / `npm run dev`.

#### C) Prisma generate (EPERM aldıysan)
Dosya kilitliyse (Expo/başka process) terminali kapatıp tekrar dene:
```bash
cd backend
npm run generate
```

## Kontrol listesi

| Adım | Durum |
|------|--------|
| Supabase 0012 migration | ✅ Uygulandı |
| Backend .env → SUPABASE_SERVICE_ROLE_KEY | **Sen ekle** (yoksa push + KBS credentials çalışmaz) |
| Backend yeniden başlat (yerel) | Yeni route’lar için gerekli |
| Railway deploy | **backend/.env** içine `RAILWAY_TOKEN=...` ekle, sonra `cd backend && npm run deploy` |

## Push’ların çalışması için (hemen)

1. **backend/.env** içinde `SUPABASE_SERVICE_ROLE_KEY` satırının başındaki `#` kaldır ve Supabase Dashboard → Settings → API → **service_role** key’i yapıştır.
2. Backend’i yeniden başlat (çalışan terminalde Ctrl+C, sonra `cd backend && npm run dev`).

## Yeni API endpoint’leri (backend yeniden başlayınca aktif)

- `POST /api/push/register` — push token (backend JWT)
- `GET /api/kbs/credentials/status` — NONE/PENDING/APPROVED
- `POST /api/kbs/credentials/request` — create/update/delete talep
- `GET /api/app-admin/requests?status=pending` — admin talep listesi
- `POST /api/app-admin/requests/:id/approve` — onay
- `POST /api/app-admin/requests/:id/reject` — red
