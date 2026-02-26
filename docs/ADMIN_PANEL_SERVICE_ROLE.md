# Admin Panel – Service Role Key Nasıl Alınır?

Admin paneli, backend’in Supabase ile kullanıcı doğrulaması yapması için **SUPABASE_URL** ve **SUPABASE_SERVICE_ROLE_KEY** değişkenlerine ihtiyaç duyar. Bu key **sadece sunucuda** (Railway / backend) kullanılmalı, mobil uygulamada veya client’ta **asla** kullanılmamalıdır.

---

## 1. Supabase’den Service Role Key almak

1. [Supabase Dashboard](https://supabase.com/dashboard) → projenize girin.
2. Sol menüden **Settings** (Ayarlar) → **API**.
3. **Project URL** kopyalayın → bu `SUPABASE_URL` olacak (örn. `https://xxxxx.supabase.co`).
4. **Project API keys** bölümünde:
   - **anon** (public) key’i mobil/client için kullanırsınız.
   - **service_role** (secret) key’i **sadece backend** için kullanın.
5. **service_role** satırında **Reveal** / **Göster** deyip key’i kopyalayın → bu `SUPABASE_SERVICE_ROLE_KEY` olacak.

![API keys](https://supabase.com/docs/img/api-key.png)  
*(Dashboard’da "service_role" gizli key olarak gösterilir.)*

---

## 2. Railway’de tanımlamak

1. [Railway](https://railway.app) → projeniz → backend servisi.
2. **Variables** sekmesine girin.
3. Şu iki değişkeni ekleyin:

| Değişken | Değer |
|----------|--------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` (sonunda `/` olmasın) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase’den kopyaladığınız **service_role** key (eyJ... ile başlar) |

4. Kaydedin; gerekirse **Redeploy** ile servisi yeniden başlatın.

---

## 3. Yerel geliştirme (backend/.env)

Backend’i bilgisayarınızda çalıştırıyorsanız:

1. `backend/.env` dosyasını açın (yoksa oluşturun).
2. Şunları ekleyin:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....
```

3. `xxxxx` ve key’i kendi Supabase projenizden alın.
4. `.env` dosyasını **asla** Git’e eklemeyin (zaten `.gitignore`’da olmalı).

---

## 4. Kontrol

- Backend yeniden başladıktan sonra uygulamada **Admin Panel** sekmesine girin.
- Hâlâ “Supabase yapılandırılmamış” veya “service role key gerekli” görürseniz:
  - Railway’de değişken isimlerinin tam olarak `SUPABASE_URL` ve `SUPABASE_SERVICE_ROLE_KEY` olduğundan emin olun.
  - Redeploy yapıp 1–2 dakika bekleyin.
  - Loglarda `[supabaseAdmin] ... eksik` uyarısı varsa key’ler okunmuyor demektir; değerleri tekrar yapıştırın (başında/sonunda boşluk olmasın).

---

## Güvenlik

- **service_role** key’i tüm RLS kurallarını atlar; sadece güvendiğiniz sunucu ortamında kullanın.
- Mobil uygulamada veya frontend’de bu key’i **asla** kullanmayın, sadece backend’de (Railway / Node sunucusu) kullanın.
