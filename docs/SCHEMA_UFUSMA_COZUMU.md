# "Veritabanı şeması güncel değil" — Kök neden ve çözüm

## Bu hata nereden geliyor?

- **Frontend değil.** `DataService#getTesis` → backend `GET /api/tesis` → backend Prisma/DB’ye soruyor → **Postgres “column/relation does not exist”** benzeri bir hata dönüyor → backend bu hatayı yakalayıp **SCHEMA_ERROR** + "Veritabanı şeması güncel değil" olarak döndürüyor.
- Backend’te **schema_version** veya migration versiyon kontrolü yok. Hata, Prisma’nın çalıştırdığı sorgunun DB’de karşılığı olmayan kolon/tablo üretmesinden kaynaklanıyor.

## Neden oluyor?

1. **Prisma şemasında olan kolon/tablo Supabase’te yok**  
   Örn. `Tesis.trialEndsAt`, `Siparis` tablosu, `Kullanici.girisOnaylandi` / `girisTalepAt` eklenmiş ama migration Supabase’e uygulanmamış.
2. **Supabase `branches` tablosunda yeni kolon yok**  
   Backend auth’ta `kbs_approved` / `kbs_approved_at` okunuyor; migration 0017 uygulanmadıysa 42703 (undefined column) oluşur (auth’ta fallback var ama diğer akışlarda sorun çıkabilir).
3. **Backend başka DB’ye, mobil/Supabase başka projeye bağlı**  
   `.env`: `DATABASE_URL` ve `SUPABASE_URL` aynı Supabase projesine işaret etmeli.

---

## Kontrol listesi

### 1) Hangi projeye bağlısın?

- **Kök `.env`:**
  - `EXPO_PUBLIC_SUPABASE_URL=https://iuxnpxszfvyrdifchwvr.supabase.co` → proje ref: **iuxnpxszfvyrdifchwvr**
- **Backend (Railway veya local):**
  - `DATABASE_URL` = Bu Supabase projesinin **PostgreSQL connection string**’i olmalı (örn. `postgresql://postgres.[ref]:...@aws-0-xx.pooler.supabase.com:5432/postgres` veya direct `db.iuxnpxszfvyrdifchwvr.supabase.co:5432`).
  - `SUPABASE_URL` = `https://iuxnpxszfvyrdifchwvr.supabase.co`

Yani **tek Supabase projesi** kullan: hem Prisma (Tesis, Oda, Siparis) hem auth/branches aynı DB’de.

### 2) Supabase’te public şema tabloları

SQL Editor’da:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

En azından şunlar olmalı: `Tesis`, `Oda`, `Kullanici`, `Misafir`, `Siparis`, … ve Supabase tarafı için `branches`, `user_profiles`.

### 3) Eksik kolonları tespit

Prisma’nın beklediği bazı kolonlar:

- **Tesis:** `trialEndsAt` (TIMESTAMP)
- **Kullanici:** `girisOnaylandi`, `girisTalepAt`
- **Siparis:** Tablo + ilişkiler
- **branches (Supabase):** `kbs_approved`, `kbs_approved_at`

Eksik olanları aşağıdaki tek SQL ile ekleyebilirsin.

---

## Tek seferde uygulanacak SQL (Supabase SQL Editor)

Aşağıdaki SQL’i **Supabase Dashboard → SQL Editor → New query** içine yapıştırıp **Run** ile çalıştır. Tümü idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`).

```sql
-- ========== 1) Prisma: Tesis ==========
ALTER TABLE "Tesis" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

-- ========== 2) Prisma: Kullanici (giriş onayı) ==========
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisOnaylandi" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Kullanici" ADD COLUMN IF NOT EXISTS "girisTalepAt" TIMESTAMP(3);

-- ========== 3) Prisma: Siparis tablosu ==========
CREATE TABLE IF NOT EXISTS "Siparis" (
    "id" TEXT NOT NULL,
    "siparisNo" TEXT NOT NULL,
    "tesisId" TEXT NOT NULL,
    "paket" TEXT NOT NULL,
    "tutarTL" INTEGER NOT NULL,
    "kredi" INTEGER NOT NULL,
    "durum" TEXT NOT NULL DEFAULT 'pending',
    "odemeAt" TIMESTAMP(3),
    "adminNot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Siparis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Siparis_siparisNo_key" ON "Siparis"("siparisNo");
CREATE INDEX IF NOT EXISTS "Siparis_tesisId_idx" ON "Siparis"("tesisId");
CREATE INDEX IF NOT EXISTS "Siparis_durum_idx" ON "Siparis"("durum");
CREATE INDEX IF NOT EXISTS "Siparis_createdAt_idx" ON "Siparis"("createdAt");
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Siparis_tesisId_fkey') THEN
        ALTER TABLE "Siparis" ADD CONSTRAINT "Siparis_tesisId_fkey"
            FOREIGN KEY ("tesisId") REFERENCES "Tesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- ========== 4) Supabase: branches (KBS onay) ==========
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.branches.kbs_approved IS 'KBS tesis bilgisi admin tarafından onaylandı mı';
COMMENT ON COLUMN public.branches.kbs_approved_at IS 'Son onay zamanı';
```

Bu script:

- Prisma tarafındaki eksik kolonları ve `Siparis` tablosunu ekler.
- Supabase `branches` tablosuna `kbs_approved` ve `kbs_approved_at` ekler.

---

## Backend’te “schema version” var mı?

**Yok.** Backend sadece Prisma/Postgres’ten gelen hata mesajına bakıyor:

- Hata metni `column|relation|does not exist|no such column` içeriyorsa → **SCHEMA_ERROR** + "Veritabanı şeması güncel değil" dönüyor.
- Yani “expectedVersion vs dbVersion” kontrolü yok; sorun **gerçekten eksik kolon/tablo**.

---

## Özet

| Ne | Nerede |
|----|--------|
| Hata mesajı | Backend (tesis.js, oda.js, rapor.js, …) catch → `isSchema` → SCHEMA_ERROR |
| Tetikleyen | Prisma sorgusu → Postgres “column/table does not exist” |
| Çözüm | Eksik kolon/tabloları Supabase’e ekle; yukarıdaki SQL tek seferde uygulanabilir |
| Proje | `EXPO_PUBLIC_SUPABASE_URL` ve backend `DATABASE_URL` / `SUPABASE_URL` aynı proje (iuxnpxszfvyrdifchwvr) olmalı |

SQL’i çalıştırdıktan sonra backend’i (ve gerekirse mobil) yeniden deneyin; "Veritabanı şeması güncel değil" kaybolmalı.
