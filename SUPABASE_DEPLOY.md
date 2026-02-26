# Supabase Edge Functions Deploy Kılavuzu

## 🔧 Proje Bağlantı Sorunu Çözümü

Eğer terminalde başka bir Supabase projesine bağlıysanız, şu adımları izleyin:

### 1. Mevcut Bağlantıyı Kontrol Et

```bash
# Supabase klasörüne git
cd supabase

# Mevcut bağlantıyı kontrol et
supabase status
```

### 2. Mevcut Bağlantıyı Kaldır (Gerekirse)

```bash
# Eğer yanlış projeye bağlıysa, bağlantıyı kaldır
supabase unlink
```

### 3. Doğru Projeye Bağlan

```bash
# MyKBS projesine bağlan
# Project ref: iuxnpxszfvyrdifchwvr (URL'den alınır)
supabase link --project-ref iuxnpxszfvyrdifchwvr
```

Alternatif olarak, `supabase/config.toml` dosyasında `project_id` zaten ayarlanmışsa:

```bash
# Sadece link komutunu çalıştır
supabase link
```

### 4. Bağlantıyı Doğrula

```bash
# Bağlantıyı kontrol et
supabase status

# Veya
supabase projects list
```

## 🚀 Edge Function Deploy

### Deploy Et

```bash
# Supabase klasöründe olduğunuzdan emin olun
cd supabase

# Edge Function'ı deploy et
supabase functions deploy trpc
```

### Deploy Seçenekleri

```bash
# Belirli bir projeye deploy et
supabase functions deploy trpc --project-ref iuxnpxszfvyrdifchwvr

# Verify JWT ile deploy et
supabase functions deploy trpc --verify-jwt

# No verify JWT ile deploy et (development)
supabase functions deploy trpc --no-verify-jwt
```

## 🔍 Sorun Giderme

### Problem: "Project not found" hatası

**Çözüm:**
```bash
# Önce login olun
supabase login

# Sonra projeye bağlanın
supabase link --project-ref iuxnpxszfvyrdifchwvr
```

### Problem: "Already linked to another project" hatası

**Çözüm:**
```bash
# Mevcut bağlantıyı kaldır
supabase unlink

# Doğru projeye bağlan
supabase link --project-ref iuxnpxszfvyrdifchwvr
```

### Problem: Global Supabase config karışıklığı

**Çözüm:**
```bash
# Global config'i kontrol et
supabase projects list

# Eğer yanlış proje görünüyorsa, local config kullan
# supabase/config.toml dosyasında project_id'yi kontrol et
```

## 📝 Manuel Deploy (CLI olmadan)

Eğer Supabase CLI sorun çıkarıyorsa, Supabase Dashboard'dan manuel deploy edebilirsiniz:

1. [Supabase Dashboard](https://app.supabase.com) → Projenize gidin
2. **Edge Functions** sekmesine gidin
3. **Create Function** butonuna tıklayın
4. Function adı: `trpc`
5. `supabase/functions/trpc/index.ts` dosyasının içeriğini kopyalayın
6. Deploy edin

## ✅ Deploy Sonrası Kontrol

```bash
# Function'ın çalıştığını kontrol et
curl https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc/health

# veya browser'da aç
# https://iuxnpxszfvyrdifchwvr.supabase.co/functions/v1/trpc
```

## 🔐 Environment Variables

Edge Function için environment variables Supabase Dashboard'dan ayarlanır:

1. Supabase Dashboard → **Edge Functions** → **trpc**
2. **Settings** → **Environment Variables**
3. Şu değişkenleri ekleyin:
   - `SUPABASE_URL`: `https://iuxnpxszfvyrdifchwvr.supabase.co`
   - `SUPABASE_ANON_KEY`: `sb_publishable_xzlZ7XfGyx9CfBaQyLWgKw_ic_v5K1J`
   - `SUPABASE_SERVICE_ROLE_KEY`: (Supabase Dashboard'dan alın)

## 📌 Hızlı Komutlar

```bash
# Projeye bağlan
cd supabase && supabase link --project-ref iuxnpxszfvyrdifchwvr

# Deploy et
supabase functions deploy trpc

# Logları görüntüle
supabase functions logs trpc

# Function'ı sil (gerekirse)
supabase functions delete trpc
```

