# Hata Sınıflandırma Standardı

İş kuralı hataları artık DB/sunucu hatası gibi gösterilmez. Tüm API hata cevapları ortak formatta döner.

## HTTP Status → Sınıf

| Status | Sınıf |
|--------|--------|
| 200 | OK |
| 400 | İstek hatalı (eksik parametre) |
| 401 | Auth yok / token geçersiz |
| 403 | Yetki yok (rol) |
| 409 / 423 | İş kuralı kilidi (onay bekliyor / şube atanmadı) |
| 500 | Gerçek sunucu/DB/bug |
| 503 | Servis yapılandırma hatası (örn. migration gerekli) |

## Response body (her yerde aynı)

```json
{
  "ok": false,
  "code": "APPROVAL_REQUIRED",
  "message": "KBS bilgileri onay bekliyor.",
  "requestId": "abc123"
}
```

## İş kuralı kodları

| Kod | Açıklama |
|-----|----------|
| APPROVAL_REQUIRED | KBS bilgisi girilmiş ama admin onayı yok |
| BRANCH_NOT_ASSIGNED | Şube/tesis kullanıcıya bağlanmamış |
| KBS_NOT_CONFIGURED | KBS bilgisi hiç girilmemiş |
| BRANCH_LOAD_FAILED | Şube bilgisi yüklenemedi |
| ROLE_FORBIDDEN | Bu sayfaya erişim yetkisi yok |

## Sistem kodları

| Kod | Açıklama |
|-----|----------|
| MISSING_DATABASE_URL | DATABASE_URL tanımlı değil |
| DB_CONNECT_ERROR | Veritabanı bağlantı hatası |
| SCHEMA_ERROR | Migration/şema güncel değil |
| UNHANDLED_ERROR | Beklenmeyen sunucu hatası |
| INVALID_TOKEN / TOKEN_EXPIRED | Token geçersiz veya süresi dolmuş |

## Backend kullanım

- `lib/errorResponse.js`: `errorResponse(req, res, status, code, message [, extra])`
- Auth/state hataları: **409** + APPROVAL_REQUIRED / BRANCH_NOT_ASSIGNED / KBS_NOT_CONFIGURED
- Sadece gerçek DB/sunucu hatalarında **500** + DB_CONNECT_ERROR / SCHEMA_ERROR / UNHANDLED_ERROR

## Mobil hata ekranları

| Durum | errorType | Ekran |
|-------|-----------|--------|
| 409 | approval | Onay Bekleniyor — "KBS bilgileriniz admin onayından sonra aktif olacaktır.", buton: Durumu Yenile |
| 403 | forbidden | Yetki yok — "Bu sayfaya erişim yetkiniz yok." |
| 500 + DB_* / SCHEMA_* | db / server | Sunucu hatası — "Sunucuda sorun var. Daha sonra tekrar deneyin.", detayda requestId |
| network | network | Offline — Bağlantı hatası |

## Log formatı

```
[REQ abc123] GET /api/oda user=U1 branch=null -> code=BRANCH_NOT_ASSIGNED status=409
```

Her hata cevabında `requestId`, `code`, `endpoint`, `userId`, `branchId` loglanır.
