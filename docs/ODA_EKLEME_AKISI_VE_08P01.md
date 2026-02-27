# Oda ekleme akışı ve 08P01 çözümü

## Nereye bağlı?

| Katman | Dosya | Açıklama |
|--------|--------|----------|
| **Mobil** | `mobile/src/screens/AddRoomScreen.js` | `api.post('/oda', { odaNumarasi, odaTipi, kapasite, not })` |
| **API** | `mobile/src/services/apiSupabase.ts` | `getBackendUrl()` → **EXPO_PUBLIC_BACKEND_URL** (örn. `https://mykbs-production.up.railway.app`) → `POST ${backendUrl}/api/oda` |
| **Backend** | `backend/src/server.js` | `app.use('/api/oda', require('./routes/oda'))` |
| **Route** | `backend/src/routes/oda.js` | Auth → Supabase ise `ensureTesisForBranch(prisma, req.branchId, req.branch.name)` → `prisma.oda.create()` → `prisma.log.create()` |
| **Tesis** | `backend/src/lib/ensureTesisForBranch.js` | Branch için Prisma’da Tesis yoksa `prisma.tesis.create()` (burada 08P01 sık görülür) |

Yani: **Mobil → BACKEND_URL (Railway) → Node /api/oda → (Supabase auth ise ensureTesisForBranch → tesis.create) → oda.create → log.create.**

## Hatalar

1. **"Veritabanı şeması güncel değil"**  
   - Prisma/Postgres: kolon veya tablo yok (migration eksik).  
   - **Çözüm:** Aynı `DATABASE_URL` ile `npx prisma migrate deploy` (Railway’de veya lokal).

2. **08P01 "insufficient data left in message"** (özellikle oda eklerken / `tesis.create`)  
   - Supabase **pooler** (Supavisor, port 6543 veya Session mode) + Prisma uyumsuzluğu.  
   - Log’da görünen: `INSERT INTO "public"."Tesis" (...) VALUES ($1..$19) RETURNING ...` ve **"unnamed portal parameter $12"** (ipAdresleri). Prisma INSERT’e 19 parametre gönderiyor, RETURNING’de tüm sütunları istiyor; pooler bu protokolü kesiyor → 08P01.  
   - **Çözüm (kalıcı, en güvenilir):** Railway’de `DATABASE_URL` = Supabase **Direct connection** (pooler kullanma).  
     - Supabase Dashboard → Project Settings → Database → **Direct** connection string (port **5432**, host `db.xxx.supabase.co`).  
     - Şifreyi yapıştır, sonda `?sslmode=require` olsun.  
   - Alternatif: Session mode URI + sonuna **`&pgbouncer=true`** (bazen yeterli olmayabilir; Direct daha kesin).  
   - Kod tarafında: `ensureTesisForBranch` 08P01’de 3 kez tekrar deniyor; kalıcı 08P01’de mutlaka Direct URL kullanın.

## Backend URL nereden geliyor?

- **Mobil:** `mobile/src/config/api.ts` → `getApiBaseUrl()` → `ENV.BACKEND_URL` → `EXPO_PUBLIC_BACKEND_URL` (veya EAS `extra.backendUrl`).  
- **EAS:** `mobile/eas.json` içinde `EXPO_PUBLIC_BACKEND_URL: "https://mykbs-production.up.railway.app"` (preview/production).  
- **Lokal .env:** `mobile/.env` içinde `EXPO_PUBLIC_BACKEND_URL=...` tanımlı olabilir.

Özet: Oda ekleme **tamamen Node backend’e** (Railway) gidiyor; Supabase sadece auth (JWT) ve branch bilgisi için kullanılıyor. Veritabanı yine **Postgres** (Supabase DB); bağlantı Railway’deki `DATABASE_URL` ile yapılıyor.

---

## Resim yükleme (Supabase Storage S3)

Resim/dosya yüklemeleri **Supabase Storage S3-compatible** endpoint'e yapılacak:

- **URL:** `https://iuxnpxszfvyrdifchwvr.storage.supabase.co/storage/v1/s3`
- **Mobil config:** `mobile/src/config/api.ts` içinde `getSupabaseStorageS3Url()` bu URL'i `ENV.SUPABASE_URL` üzerinden türetir; resim yükleme kodunda bu fonksiyon kullanılabilir.
