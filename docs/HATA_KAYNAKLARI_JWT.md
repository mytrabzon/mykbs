# Hata Kaynakları ve JWT ile İlgili Dosyalar

## 1. "Geçersiz token" (Backend Node – 401)

| Dosya | Açıklama |
|-------|----------|
| `backend/src/middleware/auth.js` | Legacy JWT doğrulama; `jwt.verify(token, JWT_SECRET)` başarısız olunca **"Geçersiz token"** döner. |
| `backend/src/middleware/authTesisOrSupabase.js` | Önce Supabase JWT, olmazsa legacy JWT dener; ikisi de olmazsa **"Geçersiz token"**. |

Bu middleware'ler `/api/tesis`, `/api/oda`, `/api/kbs/credentials` gibi route'larda kullanılıyor. Token yanlış/eksik/süresi dolmuşsa 401 alırsınız.

---

## 2. "girisOnaylandi does not exist" (Veritabanı)

| Dosya | Açıklama |
|-------|----------|
| `backend/src/routes/auth.js` | `kullanici.girisOnaylandi` kullanımı (PIN/OTP girişinde). Prisma DB'de bu kolon yoksa hata verir. |
| `backend/src/middleware/authTesisOrSupabase.js` | Legacy JWT sonrası `prisma.kullanici.findUnique` – şema `girisOnaylandi` içeriyorsa, DB'de kolon yoksa hata. |
| `backend/prisma/schema.prisma` | `Kullanici` modelinde `girisOnaylandi` alanı tanımlı. |
| **Çözüm** | Production DB'de migration çalıştırın: `npx prisma migrate deploy` veya `backend/scripts/ensure-giris-onay-column.js`. |

---

## 3. 404 – `/kbs/credentials/status` ("Durum alınamadı")

| Dosya | Açıklama |
|-------|----------|
| `backend/src/routes/kbsCredentials.js` | **GET /status** burada tanımlı. Route mount: `server.js` → `/api/kbs/credentials` → tam path: **GET /api/kbs/credentials/status**. |
| `mobile/src/services/apiSupabase.ts` | İstek: `${backendUrl}/api/kbs/credentials/status` – doğru. |

404 genelde: backend'in deploy edildiği ortamda bu route'un olmaması veya farklı base URL kullanılması. Railway'de güncel kod deploy edildiğinden emin olun.

---

## 4. 401 "Invalid JWT" / "Gecersiz veya suresi dolmus oturum" (Supabase Edge)

| Dosya | Açıklama |
|-------|----------|
| `supabase/functions/_shared/auth.ts` | `requireAuth(req)` – `Authorization: Bearer <token>` alır, `supabase.auth.getUser(token)` ile doğrular. Token yanlış/süresi dolmuşsa **401**. |
| `supabase/functions/me/index.ts` | `requireAuth(req)` çağrısı. **me** fonksiyonu auth gerektirir. |

Edge tarafında JWT, Supabase Auth'un verdiği **access token** ile doğrulanıyor. Edge'de auth'u env/secret ile kapatmak **yok**; production'da config ile auth kapatılmaz.

---

## Invalid JWT / 401 için doğru çözümler

1. **Verify JWT (Supabase Dashboard)**  
   Edge Function ayarlarında "Verify JWT" / JWT doğrulama seçeneğini doğru kullanın. Public endpoint'ler (ör. health) için fonksiyon içinde auth kullanmayın; auth gereken endpoint'ler `requireAuth(req)` ile kalsın.

2. **Public endpoint'ler: requireAuth kullanmayın**  
   Health, ping gibi anon erişilebilir fonksiyonlarda `requireAuth(req)` çağrılmamalı; bu endpoint'ler auth kontrolü olmadan çalışmalı.

3. **Mobil: Bearer = session access_token**  
   Edge Function çağrısında `Authorization` header'ı **yalnızca** `supabase.auth.getSession()` ile alınan `access_token` olmalı. Anon key **Authorization'a konmaz**; sadece `apikey` header'ında kullanılır. Session yoksa ve endpoint auth gerektiriyorsa çağrı yapılmamalı (AUTH_REQUIRED / 401).

4. **ENV tek kaynak**  
   `EXPO_PUBLIC_SUPABASE_URL` ve ilgili env'ler runtime'da tanımlı olmalı (ör. `env.ts` / app config). Logout/login sonrası stale session/cache temizlenmeli.

---

## Backend bypass (sadece local geliştirme)

Backend'de JWT bypass **sadece local/dev** ortamında ve **iki kilit** ile çalışır:

- `DISABLE_JWT_AUTH === 'true'` **ve** `NODE_ENV !== 'production'` (Railway/prod'da yanlışlıkla true olsa bile devreye girmez).
- Ek kilit: istek **localhost**'tan gelmeli (127.0.0.1 / ::1) **veya** `x-dev-bypass` header'ı `DEV_BYPASS_SECRET` ile eşleşmeli.

`backend/.env` örnek (sadece local):

```env
NODE_ENV=development
DISABLE_JWT_AUTH=true
DEV_BYPASS_SECRET=your-local-secret   # opsiyonel; yoksa sadece localhost
BYPASS_USER_ID=1
BYPASS_TESIS_ID=1
BYPASS_BRANCH_ID=<branch-uuid>        # authTesisOrSupabase için opsiyonel
```

**Uyarı:** Production'da `DISABLE_JWT_AUTH` ve `NODE_ENV=production` olmalı; bypass sadece development + localhost/header ile aktif olur.

Bu doküman, hata kaynağı dosyalarını ve JWT/Edge auth doğru kullanımını özetler.
