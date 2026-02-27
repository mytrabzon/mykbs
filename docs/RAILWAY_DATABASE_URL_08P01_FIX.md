# Railway 08P01 düzeltmesi: DATABASE_URL = Direct

Supabase log’da **08P01 "insufficient data left in message"** ve **"unnamed portal parameter $12"** (INSERT Tesis) görüyorsanız, backend **pooler** (Supavisor) üzerinden bağlanıyor. Prisma’nın `INSERT ... RETURNING` kullanımı pooler ile uyumsuz; bu yüzden **Direct** bağlantı kullanılmalı.

## Yapılacak (Railway)

1. [Supabase Dashboard](https://supabase.com/dashboard) → proje **iuxnpxszfvyrdifchwvr** → **Project Settings** → **Database**.
2. **Connection string** bölümünde **Direct** (pooler değil) seçin.
3. Örnek format:  
   `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require`  
   (Host: `db.xxx.supabase.co`, port: **5432**.)
4. [Railway](https://railway.app) → mykbs servisi → **Variables** → **DATABASE_URL**.
5. Değeri yukarıdaki **Direct** URI ile değiştirin (şifre dahil). Kaydedip servisi **Redeploy** edin.

Bundan sonra GET /api/tesis ve oda ekleme (ensureTesisForBranch → tesis.create) 08P01 vermeden çalışır.

## Neden?

- Pooler (Transaction/Session mode) Prisma’nın gönderdiği parametreli sorgu + RETURNING cevabını bazen kesiyor → "insufficient data left in message".
- Direct bağlantı pooler’dan geçmez; Prisma doğrudan Postgres’e konuşur, 08P01 oluşmaz.

Detay: `docs/ODA_EKLEME_AKISI_VE_08P01.md` ve `docs/RAILWAY_DATABASE_SESSION_MODE.md`.
