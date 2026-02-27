# Eski proje / çakışma: Gereksiz ve riskli SQL dosyaları

Bu dokümanda **kullanılmaması gereken** veya **çakışma riski taşıyan** SQL scriptleri listeleniyor. Tek kaynak: **Prisma migrations** + **Supabase migrations** + (tek seferlik) **docs/supabase_schema_fix_once.sql**.

---

## 1) Çakışma yaratan / yanlış şema (çalıştırma)

### `backend/scripts/create-admin-sql-lowercase.sql`

| Sorun | Açıklama |
|-------|----------|
| **Farklı tablo isimleri** | `tesis` ve `kullanici` (küçük harf) oluşturur. Prisma ve backend **"Tesis"** ve **"Kullanici"** (tırnaklı) kullanır. Bu script çalışırsa **ikinci bir tablo seti** oluşur; backend bunlara hiç bakmaz. |
| **ipAdresleri tipi** | Script: `"ipAdresleri" TEXT[] DEFAULT '{}'`. Prisma: `ipAdresleri String` → DB’de **TEXT**. Aynı isimde kolon farklı tablolarda olsa bile, bu script **eski proje** (array kullanan) şemasına ait. |
| **Eksik kolonlar** | `trialEndsAt`, `sifre`, `girisOnaylandi`, `girisTalepAt` yok. |

**Öneri:** Bu dosyayı **çalıştırmayın**. İsterseniz projeden kaldırın veya üzerine "DEPRECATED – kullanma" notu ekleyin.

---

### `backend/scripts/create-admin-sql.sql`

| Sorun | Açıklama |
|-------|----------|
| **ipAdresleri tipi** | `"ipAdresleri" TEXT[] DEFAULT '{}'`. Prisma şeması **TEXT** (string). Bu script ile oluşturulmuş "Tesis" tablosunda kolon **array** olur; Prisma metin bekler → tip uyuşmazlığı. |
| **Eksik kolonlar** | `trialEndsAt`, `sifre` (Kullanici’de), `girisOnaylandi`, `girisTalepAt` yok. |
| **Gereksiz** | Tablolar zaten **Prisma init** migration ile oluşturuluyor. Bu script eski/manuel kurulum için; güncel şema ile uyumlu değil. |

**Öneri:** **Çalıştırmayın.** Eski manuel kurulum scripti; Prisma + `supabase_schema_fix_once.sql` kullanın.

---

### `backend/scripts/create-admin-complete.sql` ve `backend/scripts/create-all-tables-and-admin.sql`

| Sorun | Açıklama |
|-------|----------|
| **Eski şema** | "Tesis" / "Kullanici" (ve diğer tablolar) eski kolon seti ile; `trialEndsAt`, `girisOnaylandi`, `girisTalepAt`, `Siparis` tablosu yok. |
| **ipAdresleri** | Yine **TEXT[]** kullanılıyorsa Prisma ile çakışır. |
| **Tekrarlayan içerik** | create-tables-first, create-admin-sql ile aynı mantık; farklı kombinasyonlar. Hepsi **Prisma migration’larının yerini tutmaz**. |

**Öneri:** **Çalıştırmayın.** Şema güncellemesi için sadece Prisma migrate + `docs/supabase_schema_fix_once.sql` kullanın.

---

### `backend/scripts/create-tables-first.sql`

| Sorun | Açıklama |
|-------|----------|
| **Eski şema** | "Tesis" / "Kullanici" için `ipAdresleri TEXT[]`, `trialEndsAt` ve giriş onay kolonları yok. |
| **Gereksiz** | Prisma `20260123170742_init` zaten bu tabloları oluşturuyor. Bu script “Prisma migration yapmadan tablo oluştur” diyor; artık Prisma kullanıldığı için kafa karıştırır. |

**Öneri:** **Çalıştırmayın.**

---

## 2) Tekrarlayan / iki kaynak (idempotent ama gereksiz tekrar)

Aynı değişiklik birden fazla yerde tanımlı; hepsi `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` kullandığı için aynı DB’de iki kez çalıştırılsa çakışma olmaz, ama **tek kaynak** olması daha iyi.

| Ne | Nerede tekrar | Öneri |
|----|----------------|--------|
| **trialEndsAt** | Prisma migration, Supabase 0016, apply_migrations_manual.sql, supabase_schema_fix_once.sql | Tek seferlik fix için sadece **docs/supabase_schema_fix_once.sql** (veya apply_migrations_manual) kullanın; diğerleri zaten uygulandıysa tekrar çalıştırmayın. |
| **kbs_approved / kbs_approved_at** | supabase/migrations/0017_branches_kbs_approved.sql, docs/supabase_schema_fix_once.sql | 0017 Supabase migration zincirinde; fix script’te de var (manuel çalıştırma için). İkisi de idempotent. |
| **Siparis tablosu** | Prisma 20260227150000_siparis_tablosu, apply_migrations_manual.sql, supabase_schema_fix_once.sql | Prisma migration veya tek seferlik SQL’den biri yeterli. |

---

## 3) Hangi SQL’ler kullanılsın?

| Amaç | Kullanılacak |
|------|----------------|
| **Prisma tabloları (Tesis, Oda, Kullanici, Siparis, vb.)** | `cd backend && npx prisma migrate deploy` veya Supabase’e tek seferlik: **docs/supabase_schema_fix_once.sql** |
| **Supabase tarafı (branches, user_profiles, RLS, vb.)** | **supabase/migrations/** sırasıyla (`supabase db push` veya Dashboard’da tek tek) |
| **Şema uyuşmazlığı hatası sonrası tek seferlik tamir** | **docs/supabase_schema_fix_once.sql** (Supabase SQL Editor’da çalıştır) |

---

## 4) Çalıştırılmaması gereken dosyalar (özet)

- `backend/scripts/create-admin-sql-lowercase.sql` — Küçük harf tablolar + TEXT[] → Prisma ile çakışır.
- `backend/scripts/create-admin-sql.sql` — Eski şema, ipAdresleri TEXT[].
- `backend/scripts/create-admin-complete.sql` — Eski şema.
- `backend/scripts/create-all-tables-and-admin.sql` — Eski şema.
- `backend/scripts/create-tables-first.sql` — Eski şema; Prisma init ile tekrar.

Bu scriptleri **yeni veya mevcut Supabase/Prisma DB’de çalıştırmayın.** İsterseniz dosyaların başına `-- DEPRECATED: Prisma + docs/supabase_schema_fix_once.sql kullanın.` ekleyebilir veya silip sadece dokümantasyonda referans bırakabilirsiniz.

---

## 5) ipAdresleri tip farkı (özet)

| Kaynak | Tip | Not |
|--------|-----|-----|
| **Prisma schema** | `String` → PostgreSQL **TEXT** | Güncel. |
| **create-admin-sql*.sql, create-tables-first.sql, create-all-tables-and-admin.sql** | **TEXT[]** | Eski; Prisma ile uyumsuz. Bu scriptleri çalıştırırsanız "Tesis" tablosunda ipAdresleri array olur, backend hata verebilir. |

Mevcut DB’de "Tesis" Prisma ile oluşturulduysa kolon zaten TEXT’tir; sadece bu eski scriptleri **bir daha çalıştırmayın**.
