# Supabase log hataları: 400 branches, 401 push_register_token, 401 me

Bu dokümanda paylaştığınız üç log kaydının anlamı ve çözümü.

---

## 1) GET branches → 400 (PostgREST error=42703)

**Log:** `GET | 400 | .../rest/v1/branches?select=id,name,kbs_turu,kbs_tesis_kodu,kbs_web_servis_sifre,kbs_configured,kbs_endpoint_url&id=eq....`  
**Response:** `proxy_status: "PostgREST; error=42703"`

**Anlamı:** PostgreSQL hatası **42703 = undefined_column**. Sorguda seçilen kolonlardan en az biri `branches` tablosunda yok.

Backend (Node) bu kolonları istiyor: `id`, `name`, `kbs_turu`, `kbs_tesis_kodu`, `kbs_web_servis_sifre`, `kbs_configured`, `kbs_endpoint_url`. Bunlar Supabase migration’larla ekleniyor:

- **0005_optimize_branches_indexes.sql** → `kbs_configured`
- **0006_kbs_outbox_and_branch_kbs.sql** → `kbs_turu`, `kbs_tesis_kodu`, `kbs_web_servis_sifre`
- **0007_branches_kbs_endpoint_url.sql** → `kbs_endpoint_url`

**Çözüm:** Supabase projesinde bu migration’ların hepsi uygulanmış olmalı.

```bash
# Supabase CLI ile (proje kökünde)
supabase db push
# veya tek tek
supabase migration up
```

Supabase Dashboard → SQL Editor’da da migration dosyalarındaki `ALTER TABLE branches ADD COLUMN ...` ifadelerini sırayla çalıştırabilirsiniz. Sonrasında `branches` için bu kolonlar var olmalı ve 400 kaybolur.

---

## 2) POST push_register_token → 401

**Log:** `POST | 401 | .../functions/v1/push_register_token`  
**Request:** `"authorization": []` (Authorization header yok veya geçersiz)

**Anlamı:** Edge Function `push_register_token`, **Supabase kullanıcı JWT’i** bekliyor (`Authorization: Bearer <access_token>`). İstek ya hiç token göndermiyor ya da **backend JWT** (telefon+şifre ile girişte dönen) gönderiliyor. Backend JWT, Supabase tarafından kullanıcı olarak kabul edilmez → 401.

**Çözüm:**  
- Sadece **gerçek Supabase oturum token’ı** (Supabase OTP/email girişinden dönen `access_token`) Edge’e gönderilmeli.  
- Mobil tarafta `getSupabaseToken()` artık yalnızca Supabase token’ını döndürüyor; backend JWT Supabase’e gönderilmiyor.  
- Telefon+şifre ile giren kullanıcıda Supabase token olmayacağı için `push_register_token` çağrılmıyor (zaten `pushNotifications.js` token yoksa çıkıyor). 401 bu senaryoda oluşmamalı; oluşuyorsa eski build’de backend JWT gönderiliyordu demektir.

---

## 3) POST me → 401

**Log:** `POST | 401 | .../functions/v1/me`  
**Request:** `"authorization": []`

**Anlamı:** Aynı mantık: `me` Edge Function da **Supabase JWT** istiyor. Authorization boş veya backend JWT ise 401 döner.

**Çözüm:**  
- Kullanıcı bilgisi için: **Supabase token varsa** `getMe(supabaseToken)` (Edge `me`) kullanılsın, **yoksa** backend `GET /auth/me` kullanılsın.  
- `getSupabaseToken()` sadece Supabase token’ını döndürür; böylece backend JWT yanlışlıkla Edge’e gitmez ve bu 401’ler kaybolur.

---

## Özet

| Hata | Sebep | Çözüm |
|------|--------|--------|
| **400 branches** | `branches` tablosunda KBS kolonları yok (42703) | Migration’ları uygula: 0005, 0006, 0007 |
| **401 push_register_token** | Edge’e Supabase JWT gitmiyor veya backend JWT gidiyor | Mobil: sadece Supabase token ile çağır; token yoksa çağırma |
| **401 me** | Aynı: Edge’e geçerli Supabase JWT gitmiyor | getSupabaseToken = sadece Supabase token; me yoksa backend /auth/me kullan |

---

## 4) Mobil terminal: Geçersiz token (odalar), 404 credentials/status, 502 ocr/mrz

**Loglar (Expo terminal):**
- `Get odalar error [Error: Geçersiz token]`
- `API GET Error … /kbs/credentials/status … 404 … "Durum alınamadı"`
- `API POST Error … /ocr/mrz … 502 … "Application failed to respond"`

### 4.1 Odalar – Geçersiz token (401)

**Anlamı:** Mobil önce Node backend'e `GET /api/oda?filtre=...` atıyor; backend `authenticateTesisOrSupabase` ile Supabase JWT doğruluyor. Token geçersizse veya Railway'de Supabase ortam değişkenleri eksikse 401 döner.

**Çözüm:**
- **Railway'de** backend servisinde mutlaka tanımlı olsun: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Token'ın Supabase oturumundan gelen `access_token` olduğundan emin olun (logout/login deneyin).
- `docs/HATA_KAYNAKLARI_JWT.md` içindeki JWT ve bypass notlarına bakın.

### 4.2 GET /kbs/credentials/status → 404 "Durum alınamadı"

**Anlamı:** Backend'de route var: `GET /api/kbs/credentials/status` (`kbsCredentials.js` → `server.js`). 404 genelde deploy'un eski olması veya farklı base URL kullanılması demektir.

**Çözüm:**
- Railway'e güncel backend kodunu deploy edin.
- Mobil `EXPO_PUBLIC_BACKEND_URL` ile `https://mykbs-production.up.railway.app` aynı mı kontrol edin; 404 devam ederse Railway loglarında bu path'e gelen istek var mı bakın.

### 4.3 POST /ocr/mrz → 502 "Application failed to respond"

**Anlamı:** OCR endpoint'i Tesseract + Jimp kullanıyor; soğuk başlangıç veya ağır işlem Railway'de zaman aşımına veya process çökmesine yol açıyor. Proxy "uygulama yanıt vermedi" (502) döner.

**Çözüm:**
- Railway'de request timeout'u artırın (varsa).
- OCR'ı hafifletmek: daha küçük görsel, tek dil (`eng`), gerekirse timeout/abort ekleyin.
- Gerekirse OCR'ı ayrı bir worker servisine veya daha büyük instance'a taşıyın.
