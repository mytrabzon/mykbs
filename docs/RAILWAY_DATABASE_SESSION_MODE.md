# Railway: "Can't reach database server" — Session mode ile çözüm

Supabase projesi **Healthy** ama Railway backend hâlâ `Can't reach database server at db.xxx.supabase.co:6543` veriyorsa, bağlantıyı **Session mode** (pooler) ile deneyin. Session mode farklı bir sunucu kullanır ve IPv4 uyumludur.

## Adımlar

### 1. Supabase’ten Session mode URI al

1. [Supabase Dashboard](https://supabase.com/dashboard) → projeni aç (**iuxnpxszfvyrdifchwvr**).
2. Sol menüden **Project Settings** (dişli) → **Database** veya ana sayfada **Connect** butonuna tıkla.
3. **Connection string** bölümünde **Session mode** (veya "Use connection pooling" → Session) seçeneğini seç.
4. **URI** kutusundaki bağlantı dizesini kopyala. Örnek format:
   ```text
   postgresql://postgres.iuxnpxszfvyrdifchwvr:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
   ```
   Şifreyi kendi DB şifrenle değiştir. Sonda `?sslmode=require` ekleyin (SSL için).

### 2. Railway’de DATABASE_URL güncelle

1. [Railway Dashboard](https://railway.app) → **marvelous-generosity** projesi → **mykbs** servisi.
2. **Variables** sekmesine gir.
3. **DATABASE_URL** satırını bul, **Edit** (veya değişkeni silip yeniden ekle).
4. Yapıştır: Supabase’ten kopyaladığın **Session mode** URI’si (şifre dahil, tek satır).
5. Kaydet. Gerekirse servisi **Redeploy** et veya bir kez **Restart** et.

### 3. Test

Mobil uygulamada Odalar / tesis ekranını tekrar aç. Backend artık pooler üzerinden bağlanacak; "Bilgi alınamadı" / "Veritabanı hatası" kaybolmalı.

## Not

- **Transaction mode** (port 6543, `db.xxx.supabase.co`) bazen Railway ağından erişilemez.
- **Session mode** (port 5432, `aws-0-xxx.pooler.supabase.com`) IPv4 destekler ve dış bağlantılarda genelde daha sorunsuz çalışır.
