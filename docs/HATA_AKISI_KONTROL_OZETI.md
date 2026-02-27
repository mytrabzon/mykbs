# Hata Akışı Kontrol Özeti (errorResponse + Mobil)

## 1) Backend — errorResponse kullanımları

| Dosya | Kullanım |
|-------|----------|
| **lib/errorResponse.js** | Tanım: `errorResponse(req, res, status, code, message [, extra])`, `logErrorResponse`, `successResponse` |
| **middleware/authTesisOrSupabase.js** | 401 INVALID_TOKEN, TOKEN_EXPIRED; 409 BRANCH_NOT_ASSIGNED, BRANCH_LOAD_FAILED; 503 SCHEMA_ERROR |
| **middleware/authSupabase.js** | 401 INVALID_TOKEN; 409 BRANCH_NOT_ASSIGNED, BRANCH_LOAD_FAILED; 503 UNHANDLED_ERROR; 500 UNHANDLED_ERROR |
| **routes/tesis.js** | 500 SCHEMA_ERROR, DB_CONNECT_ERROR, UNHANDLED_ERROR (GET, PUT bilgi, GET/PUT kbs, POST talebi, POST kbs/test); 403 ROLE_FORBIDDEN; 503 Supabase |
| **routes/oda.js** | 500 SCHEMA/DB/UNHANDLED (liste, detay, POST, PUT, DELETE) |
| **routes/rapor.js** | 500 SCHEMA/DB/UNHANDLED |
| **routes/bildirim.js** | 500 SCHEMA/DB/UNHANDLED (liste, toplu, tekrar, PDF) |
| **routes/api/checkin.js** | 409 APPROVAL_REQUIRED (KBS onay yok); 503/500 UNHANDLED_ERROR (checkin, checkout, room-change) |
| **server.js** | Global error handler: `errRes(req, res, status, code, message)`; health/db: 500 body `ok, code, message, requestId` |

**Standart hata body:** `{ ok: false, code, message, requestId }`. İş kuralı: 409 (APPROVAL_REQUIRED, BRANCH_NOT_ASSIGNED, …). Yetki: 403 (ROLE_FORBIDDEN). Sistem: 500 (SCHEMA_ERROR, DB_CONNECT_ERROR, UNHANDLED_ERROR).

## 2) Mobil — 409 / 403 / 500 ayrımı

| Ekran / Kaynak | Davranış |
|----------------|----------|
| **OdalarScreen** | loadData catch: 409 → lastLoadErrorType `approval`, BackendErrorScreen “Onay Bekleniyor”; 403 → `forbidden` “Yetki yok”; 500 + code DB_* → `db`/`server`, requestId detayda. |
| **BackendErrorScreen** | errorType: `approval`, `forbidden`, `db`, `server`, `auth`, `network`, `path`. requestId ve serverMessage prop ile detay. |
| **RaporlarScreen** | api.get('/rapor') catch: 409 → Toast “Onay Bekleniyor”; 403 → “Yetki yok”; 500 → “Sunucu hatası”. |
| **dataService (getTesis, getOdalar)** | Hata fırlatır; response.data içinde code, message, requestId. OdalarScreen/AnaSayfa bu hatayı yakalayıp yukarıdaki mantıkla işler. |
| **CheckInScreen / AuthContext** | error.response?.data?.message kullanır; 409 APPROVAL_REQUIRED backend’den gelirse mesaj gösterilir. |

## 3) Eksik tamamlanan noktalar (yapılanlar)

- oda.js: GET /:odaId, POST, PUT, DELETE catch → errorResponse (SCHEMA/DB/UNHANDLED).
- tesis.js: PUT bilgi, GET/PUT kbs, POST talebi, POST kbs/test catch + 403 yetki → errorResponse / ROLE_FORBIDDEN; 503 Supabase → errorResponse.
- api/checkin.js: 503, 500 (checkin, checkout, room-change) → errorResponse.
- RaporlarScreen: 409/403/500’e göre farklı Toast mesajı.

## 4) Log formatı

Backend’de her errorResponse çağrısında:

```
[REQ <requestId>] <METHOD> <path> user=<userId> branch=<branchId> -> code=<code> status=<status> <message>
```

Global error handler da aynı formatta loglar.
