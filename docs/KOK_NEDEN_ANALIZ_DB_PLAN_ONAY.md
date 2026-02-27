# MYKBS — Kök Neden Analizi: "Bazı sayfalar çalışıyor, bazıları DB/plan/onay hatası"

**Amaç:** Prod (Railway) ortamda kısmi çalışma senaryosunun kök nedenini tespit; hata matrisi, fix listesi, health check ve onboarding dokümantasyonu.

---

## 1) Hata matrisi (Ekran/Endpoint → Hata → Katman)

| Ekran/Endpoint | Olası hata kodu/mesaj | Katman | Açıklama |
|----------------|------------------------|--------|----------|
| **GET /health** | 200 / timeout | Backend (Express) | DB kullanmaz; çalışıyorsa her zaman 200. |
| **GET /health/db** | 500 MISSING_DATABASE_URL / Prisma error | Backend + Prisma | DATABASE_URL yok veya Prisma bağlanamıyor. |
| **GET /api/tesis** | 401 PROFILE_MISSING, BRANCH_NOT_ASSIGNED, BRANCH_LOAD_FAILED | authTesisOrSupabase | Supabase user_profiles/branches yok veya branch yüklenemiyor. |
| **GET /api/tesis** | 401 TESIS_MISSING, INVALID_TOKEN | authTesisOrSupabase | Legacy JWT: kullanıcı var tesis yok veya token geçersiz. |
| **GET /api/tesis** | 503 DB_MIGRATION_REQUIRED | authTesisOrSupabase | Prisma'da girisOnaylandi sütunu yok (migrate deploy gerekli). |
| **GET /api/tesis** | 500 "Veritabanı hatası. Railway'de DATABASE_URL..." | tesis.js catch | Her türlü Prisma/DB exception bu mesajla dönüyor (yanıltıcı: RLS/schema da olabilir). |
| **GET /api/oda** | 401 (yukarıdaki auth kodları) | authTesisOrSupabase | Aynı auth; profile/branch yoksa odalar da gelmez. |
| **GET /api/oda** | 500 "Odalar alınamadı" | oda.js catch | Prisma/ensureTesisForBranch hatası; mesaj DB'ye özgü değil. |
| **POST /api/auth/giris** | 403 "Tesis henüz onaylanmamış" | auth.js | Tesis.durum !== 'onaylandi'. |
| **POST /api/auth/giris** | 403 "Tesis aktif değil" | auth.js | Tesis.durum !== 'aktif'. |
| **POST /api/auth/giris** | 200 + pendingApproval: true | auth.js | girisOnaylandi false → "Admin onayına sunuldu". |
| **Kayıt (supabase-create)** | 500 "Kayıt tamamlanamadı" | auth.js | Prisma create/ensureSupabaseBranchAndProfile hatası. |
| **Mobil Odalar ekranı** | Boş liste + BackendErrorScreen (db) | OdalarScreen | Sadece /health ok + /health/db fail ise errorType='db'. |
| **Mobil Odalar ekranı** | 401 → logout | OdalarScreen | getOdalar 401 → lastLoadErrorType null, logout. |
| **Mobil Odalar ekranı** | 500 → "network" | OdalarScreen | lastLoadErrorType='network'; sunucu mesajı "Veritabanı hatası" olabilir. |

**Özet:** "DB hatası" gibi görünen birçok durum aslında **auth/onay/plan** (PROFILE_MISSING, BRANCH_NOT_ASSIGNED, tesis aktif değil, girisOnaylandi) veya **migration/schema** (girisOnaylandi kolonu, ensureTesisForBranch constraint). Gerçek bağlantı hatası sadece DATABASE_URL eksik/yanlış veya Prisma $queryRaw`SELECT 1` fail olduğunda kesin.

---

## 2) Tespit edilen kök nedenler ve kesin fix listesi

### Kök neden 1: Hata sınıflandırmasının tek mesaja indirgenmesi (tesis/oda)

- **Bulgu:** `tesis.js` catch bloğunda her exception için `isDb = /prisma|ECONNREFUSED|.../` ile "Veritabanı hatası. Railway'de DATABASE_URL..." dönülüyor. RLS, eksik kolon, constraint, profile/branch yok gibi durumlar da aynı mesajla kullanıcıya yansıyor.
- **Kanıt:** `backend/src/routes/tesis.js` satır 126–133.
- **Etki:** Kullanıcı ve destek "DB sorunu" sanıyor; aslında tesis aktif değil veya şube atanmamış olabiliyor.
- **Fix:** Hata kodlarını ayır: `code: 'DB_ERROR'` sadece gerçek bağlantı/Prisma hatası için; 403/401 benzeri durumlar için `code: 'TESIS_INACTIVE'`, `PROFILE_MISSING` vb. ve mesajı buna göre ver. Client tarafında bu kodlara göre farklı UI (tesis aktif değil vs veritabanı yok).

### Kök neden 2: Tenant/tesis kaynağı çift yapı (Supabase branch + Prisma Tesis)

- **Bulgu:** Mobil Supabase token ile girişte `authTesisOrSupabase` önce Supabase `user_profiles.branch_id` ve `branches` ile ilerliyor. Odalar/tesis verisi ise Prisma `Tesis`/`Oda` üzerinden; `ensureTesisForBranch` ile branch_id için Prisma'da Tesis yoksa oluşturuluyor. Supabase'de profil/branch yoksa 401 (PROFILE_MISSING/BRANCH_NOT_ASSIGNED); Prisma'da migration/şema uyumsuzluğu varsa 500.
- **Kanıt:** `backend/src/middleware/authTesisOrSupabase.js`, `backend/src/lib/ensureTesisForBranch.js`, `backend/src/routes/oda.js` (getTesisId = branchId veya req.tesis.id).
- **Etki:** Bazı kullanıcılar (profil/branch tam) çalışır, bazıları (yeni kayıt, şube atanmamış, tesis onay bekliyor) "DB/plan/onay" benzeri hata alır.
- **Fix:** (1) Kayıt/signup sonrası Supabase tarafında `user_profiles` ve gerekirse `branches` oluşturulduğundan emin ol (ensureSupabaseBranchAndProfile dokümante edildi). (2) 401 cevaplarında `code: PROFILE_MISSING | BRANCH_NOT_ASSIGNED | BRANCH_LOAD_FAILED` dön; client bu kodlara göre "Şube atanmamış / Hesap henüz bağlı değil" mesajı göstersin. (3) RLS/schema hatalarını 500 içinde "DB_ERROR" ile karıştırma; mümkünse PG/Prisma code ile ayrıştır.

### Kök neden 3: Tek DB config ama farklı hata yolları

- **Bulgu:** Backend’de DB erişimi tek: `process.env.DATABASE_URL` ve Prisma. Farklı env isimleri (SUPABASE_DB_URL) sadece script’lerde (create-admin-supabase.js). Asıl karışıklık: aynı DB’ye giden isteklerde bazı route’lar auth’tan geçemiyor (401), bazıları Prisma/ensureTesisForBranch’te patlıyor (500); ikisi de kullanıcıya "veritabanı / sunucu hatası" gibi yansıyor.
- **Kanıt:** Tüm route’lar `require('@prisma/client')` + `new PrismaClient()`; DATABASE_URL sadece server.js ve script’lerde.
- **Etki:** "Bazı sayfalar çalışıyor" = auth + Prisma’nın ikisi de geçen route’lar; "bazıları patlıyor" = auth reddi (401) veya Prisma/şema hatası (500).
- **Fix:** (1) Hata cevaplarında tutarlı `code` ve HTTP status: 401 = yetki/profil/şube, 503 = migration gerekli, 500 = gerçek DB/uygulama hatası. (2) Health check’te /health vs /health/db ayrımı + hata kodları (aşağıda). (3) Request ID + merkezi error middleware ile log’da endpoint, userId, tenantId/branchId, error.code ile ayırt et.

---

## 3) Health check iyileştirmesi (/health ve /health/db ayrımı + hata kodları)

- **/health:** Sadece uygulama ayakta; DB kullanılmaz. Dönüş: `{ ok: true, service, ts, version }`. Hata kodu yok.
- **/health/db:** DATABASE_URL varlığı + Prisma `SELECT 1`. Olası cevaplar:
  - 200: `{ ok: true, db: true }`
  - 500: `{ ok: false, error: { code: 'MISSING_DATABASE_URL', message: '...' } }`
  - 500: `{ ok: false, error: { code: 'DB_CONNECT_ERROR', message: '...', pgCode?: '...' } }` (Prisma/PG hata kodu varsa eklenir)

Bu sayede mobil/client: /health ok + /health/db 500 → gerçekten "veritabanı bağlantısı yok"; /health ok + /health/db 200 + /api/tesis veya /api/oda 401 → "yetki/şube/onay" mesajı verilebilir.

---

## 4) Onboarding / plan-onay / tesis aktivasyon state machine

```
[Kayıt]
  ├─ Supabase OTP (kayit/supabase-create) ──► Prisma: Tesis (durum: aktif) + Kullanici + ensureSupabaseBranchAndProfile
  ├─ Tesis kodu + aktivasyon (auth/aktivasyon) ──► Tesis durum: aktif
  └─ Başvuru (auth/basvuru) ──► Tesis (durum: incelemede) ──► Admin onayla ──► onaylandi / aktif

[Giriş]
  ├─ Supabase (telefon/şifre) ──► user_profiles.branch_id + branches gerekli
  │     ├─ branch_id yok ──► 401 PROFILE_MISSING / BRANCH_NOT_ASSIGNED
  │     └─ branch_id var ──► ensureTesisForBranch ──► /api/tesis, /api/oda çalışır
  └─ Tesis kodu + PIN (auth/giris) ──► Prisma Kullanici + Tesis
        ├─ Tesis.durum !== onaylandi ──► 403 "Tesis henüz onaylanmamış"
        ├─ Tesis.durum !== aktif ──► 403 "Tesis aktif değil"
        ├─ !girisOnaylandi ──► 200 + pendingApproval: true ("Admin onayına sunuldu")
        └─ girisOnaylandi + aktif ──► token, tesis, odalar açılır

[Ekran kilidi]
  - Odalar / Tesis / Raporlar: authenticateTesisOrSupabase geçmeli (Supabase branch veya Prisma tesis).
  - Trial bitti: CreditsContext/PaywallModal (trial_ended).
  - Kota bitti: PaywallModal (no_credits).
```

**State özeti**

| State | Tesis.durum | girisOnaylandi (PIN giriş) | Sonuç |
|-------|-------------|-----------------------------|--------|
| Başvuru bekliyor | incelemede | - | Giriş 403 "Tesis henüz onaylanmamış" |
| Onaylandı, PIN onayı bekliyor | onaylandi/aktif | false | Giriş 200 + pendingApproval |
| Aktif | aktif | true | Tam erişim |
| Supabase kullanıcı, şube yok | - | - | 401 BRANCH_NOT_ASSIGNED / PROFILE_MISSING |

---

## 5) Bulgu → Kanıt → Etki → Fix tablosu

| Bulgu | Kanıt (dosya/satır) | Etki | Fix (commit önerisi) |
|-------|----------------------|------|----------------------|
| tesis.js her hatayı "Veritabanı hatası" yapıyor | tesis.js 126–133 | Yanlış teşhis, kullanıcı DB sanıyor | Hata kodları: DB_ERROR / TESIS_INACTIVE / SCHEMA_ERROR; mesajı buna göre ayır |
| 401’lerde code (PROFILE_MISSING vb.) zaten var | authTesisOrSupabase.js 114–134 | Client bunu göstermiyor olabilir | Mobilde 401 response body’deki code’a göre "Şube atanmamış" vs göster |
| /health/db hata cevabında code yok | server.js 64–78 | Client sadece 500 görüyor | /health/db’de error.code: MISSING_DATABASE_URL | DB_CONNECT_ERROR |
| Request/trace ID yok | - | Log’da istek takibi zor | requestId middleware + error middleware’de logla |
| ensureTesisForBranch Prisma’da Tesis create ediyor | ensureTesisForBranch.js 17–34 | Şema uyumsuzluğunda 500, "DB hatası" sanılır | Hata yakalayıp code: SCHEMA_ERROR veya constraint adı dön |
| Odalar verisi tek kaynak: BACKEND_URL | dataService.ts 332–366 | BACKEND_URL varsa hep Node /api/oda | Zaten tek kaynak; 401/500 ayrımı için response code/code kullan |
| rooms_list (Supabase) farklı veri: guests tablosu | supabase/functions/rooms_list/index.ts 32–44 | Backend kullanılmazsa liste "guests"ten; Node kullanılıyor | Prod’da BACKEND_URL set, odalar hep Node’dan |

---

## 6) Prod doğrulama checklist (10 madde)

1. **Railway’de DATABASE_URL** set ve Prisma’nın kullandığı tek URL (direct connection; pgbouncer kullanılıyorsa migration için DIRECT_URL ayrı olabilir).
2. **Migration:** `npx prisma migrate deploy` prod deploy sonrası veya startup’ta çalıştı; `girisOnaylandi`, `trialEndsAt` kolonları mevcut.
3. **GET /health** → 200, **GET /health/db** → 200 (ok: true, db: true); /health/db 500 ise log’da MISSING_DATABASE_URL veya DB_CONNECT_ERROR + pgCode.
4. **Supabase:** SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set; auth ve user_profiles/branches senkron (yeni kullanıcıda ensureSupabaseBranchAndProfile çağrılıyor).
5. **401 cevaplarında** body’de `code` (PROFILE_MISSING, BRANCH_NOT_ASSIGNED, BRANCH_LOAD_FAILED, TESIS_MISSING) var; mobil bu koda göre mesaj gösteriyor.
6. **500 “Veritabanı hatası”** sadece gerçek Prisma/DB hatalarında; tesis aktif değil / şube yok 401/403 ile ayrı.
7. **Request ID** her istekte log’da; hata log’unda endpoint, userId, branchId/tesisId, error.code mevcut.
8. **Odalar ekranı:** BACKEND_URL set olduğu için /api/oda kullanılıyor; 401 → logout, 500 → network/uygun mesaj, /health/db fail → "Veritabanı bağlantısı yok".
9. **Signup (supabase-create):** Kayıt sonrası Prisma Tesis + Kullanici + ensureSupabaseBranchAndProfile; bir sonraki girişte branch_id ile /api/tesis ve /api/oda çalışıyor.
10. **Admin onay akışı:** Tesis onayla (durum: onaylandi/aktif), giriş onayı (girisOnaylandi); client pendingApproval ve "Tesis aktif değil" mesajlarını doğru gösteriyor.

---

## 7) Oda (rooms) neden patlıyor — özet

- **Çağrılan endpoint:** Mobil `BACKEND_URL` set olduğunda `GET ${backendUrl}/api/oda?filtre=...` (dataService.getOdalar). Auth: Bearer token (Supabase access_token veya legacy JWT).
- **Sunucu tarafı:** authenticateTesisOrSupabase → Supabase’te user_profiles.branch_id + branches; yoksa 401 (PROFILE_MISSING, BRANCH_NOT_ASSIGNED, BRANCH_LOAD_FAILED). Sonra ensureTesisForBranch(prisma, branchId, branch.name); ardından prisma.oda.findMany({ where: { tesisId } }).
- **Patlama sebepleri:** (1) 401: Token yok/geçersiz veya profil/şube eksik. (2) 500: Prisma bağlantı hatası, migration/şema (ör. Tesis tablosunda eksik kolon), ensureTesisForBranch create hatası (constraint/unique). (3) RLS kullanılmıyor (Prisma doğrudan DB); Supabase Edge rooms_list ise `guests` tablosu kullanıyor, prod’da odalar Node’dan geldiği için RLS bu akışta devreye girmiyor.
- **Ne dönüyor:** 401’de body’de message + code; 500’de tesis.js "Veritabanı hatası...", oda.js "Odalar alınamadı" + error.message. Request ID şu an log’da yok (eklendiğinde log’da görülecek).

---

## 8) Adım 0 — ENV / Config haritası

| Konu | Nerede | Değer |
|------|--------|-------|
| DB bağlantısı | Tek yerde: Prisma `env("DATABASE_URL")` | Tüm route'lar `new PrismaClient()` (her dosyada ayrı instance) |
| DATABASE_URL | server.js, .env, script'ler | Backend’de tek isim: DATABASE_URL. Script’lerde alternatif: SUPABASE_DB_URL (create-admin-supabase.js) |
| DIRECT_URL | Prisma schema’da yok | Sadece DATABASE_URL kullanılıyor |
| Tenant/tesis id | Supabase: user_profiles.branch_id → branches.id. Legacy: JWT → Prisma Kullanici.tesisId | Header (x-tenant-id) yok; auth middleware JWT/access_token’dan çıkarıyor |

---

## 9) Adım 1 — Endpoint envanteri (özet)

| Route / prefix | DB client | Auth | Tenant/tesis |
|----------------|-----------|------|--------------|
| GET /health | - | - | - |
| GET /health/db | Prisma (SELECT 1) | - | - |
| /api/auth/* | Prisma | Bazıları authenticate, bazıları yok | Tesis kodu / OTP / Supabase |
| /api/tesis | Prisma + supabaseAdmin | authenticateTesisOrSupabase | branchId veya req.tesis.id |
| /api/oda | Prisma | authenticateTesisOrSupabase | getTesisId(req) |
| /api/misafir | Prisma | authenticateTesisOrSupabase | Evet |
| /api/rapor | Prisma | authenticateTesisOrSupabase | Evet |
| /api/bildirim | Prisma | authenticateTesisOrSupabase | Evet |
| /api/admin | Prisma | (admin auth) | - |
| /api/app-admin | Prisma + supabaseAdmin | (app-admin auth) | - |
| /api/kyc | Prisma | - | - |
| /api/siparis | Prisma | authenticate | req.user |
| /api/kbs/credentials | supabaseAdmin | - | branch_id query |
| /api (checkin, checkout, room-change) | supabaseAdmin + Prisma/outbox | JWT/bearer | branch |
| /internal/kbs/worker | supabaseAdmin | x-worker-secret | - |

Tüm Prisma kullanan route’lar aynı DATABASE_URL’i kullanır (env’den tek config).

---

## 10) Hızlı repro script (Adım 7)

Backend’de: `backend/scripts/prod-repro.js`

```bash
cd backend
node scripts/prod-repro.js
# veya
BASE_URL=https://mykbs-production.up.railway.app node scripts/prod-repro.js
# Giriş ile tesis/oda denemek için:
TEST_TESIS_KODU=XXX TEST_PIN=YYYY BASE_URL=https://... node scripts/prod-repro.js
```

Her adımda status + body özeti yazılır: /health, /health/db, (isteğe bağlı) signup, login, GET /api/tesis, GET /api/oda.

---

Bu doküman, health check iyileştirmesi, requestId/error middleware ve repro script ile birlikte güncellenmiştir.
