# Migration 0017 — branches.kbs_approved / kbs_approved_at

Bu migration, Supabase `public.branches` tablosuna KBS admin onay bilgisini ekler. Backend, KBS talebi onaylandığında bu kolonları günceller; checkin ve diğer KBS işlemleri `kbs_approved` ile hızlı kontrol yapar.

## Dosya

- **Supabase:** `supabase/migrations/0017_branches_kbs_approved.sql`

## İçerik

```sql
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS kbs_approved_at TIMESTAMPTZ NULL;
COMMENT ON COLUMN public.branches.kbs_approved IS 'KBS tesis bilgisi admin tarafından onaylandı mı';
COMMENT ON COLUMN public.branches.kbs_approved_at IS 'Son onay zamanı (facility_credentials_requests.reviewed_at ile senkron)';
```

## Çalıştırma adımları

### 1) Supabase Dashboard (önerilen)

1. [Supabase Dashboard](https://supabase.com/dashboard) → projenizi seçin.
2. **SQL Editor** → **New query**.
3. `0017_branches_kbs_approved.sql` dosyasının içeriğini yapıştırın.
4. **Run** ile çalıştırın.

### 2) Supabase CLI (yerel migration)

Proje kökünde:

```bash
# Supabase CLI ile migration uygula (uzak DB’ye)
npx supabase db push
```

veya sadece bu migration’ı çalıştırmak için:

```bash
# Bağlantı string’i ile (Supabase → Settings → Database → Connection string)
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f supabase/migrations/0017_branches_kbs_approved.sql
```

### 3) Migration sonrası kontrol

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'branches'
  AND column_name IN ('kbs_approved', 'kbs_approved_at');
```

İki satır dönmeli: `kbs_approved` (boolean, NOT NULL, default false), `kbs_approved_at` (timestamp with time zone, nullable).

## Rollback (geri alma)

Kolonları kaldırmak için (gerekirse):

```sql
-- Rollback 0017: branches.kbs_approved / kbs_approved_at kaldır
ALTER TABLE public.branches DROP COLUMN IF EXISTS kbs_approved_at;
ALTER TABLE public.branches DROP COLUMN IF EXISTS kbs_approved;
```

**Dikkat:** Rollback sonrası backend, bu kolonları okuyan yerlerde (authSupabase branch select, appAdmin approve) hata alabilir. Backend’de 42703 (undefined column) durumunda fallback kullanılıyor; yine de rollback yapmadan önce backend’i bu kolonlara bağımlı olmayacak şekilde güncellemek veya migration’ı geri almamak daha güvenlidir.

## Backend etkisi

- **appAdmin.js:** KBS talebi onaylanınca `branches` için `kbs_approved = true`, `kbs_approved_at = reviewed_at`, `kbs_configured = true` güncellenir.
- **authSupabase.js / authTesisOrSupabase.js:** Branch okurken `kbs_approved`, `kbs_approved_at` seçilir (kolon yoksa 42703 fallback ile `kbs_approved: false` kullanılır).
- **api/checkin.js:** `branch.kbs_configured && !branch.kbs_approved` ise 409 APPROVAL_REQUIRED döner; KBS gönderimi `kbs_approved` true olduğunda yapılır.

Migration uygulanmadan da backend çalışır (fallback sayesinde); migration sonrası onaylı branch’ler doğru şekilde işaretlenir.
