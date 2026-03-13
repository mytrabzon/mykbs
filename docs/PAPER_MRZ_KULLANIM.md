# Kağıt / Fotokopi MRZ (HMS Benzeri) — Çalıştırma

## 1. Backend’in çalışıyor olması

- Backend’i başlatın:
  ```bash
  cd backend && npm run dev
  ```
- Ortam değişkenleri:
  - `DATABASE_URL` (Prisma)
  - `JWT_SECRET` (auth)
  - Gerekirse `EXPO_PUBLIC_BACKEND_URL` ile aynı adresin kullanıldığından emin olun

## 2. Mobil uygulama ayarı

- `.env` veya `app.config.js` / `app.config.ts` içinde backend adresi tanımlı olmalı:
  - **EXPO_PUBLIC_BACKEND_URL** = backend’in adresi (örn. `http://192.168.1.x:3000` veya production URL)
- Uygulama giriş yapmış olmalı (POST /paper-mrz tesis/token ile korunuyor).

## 3. Kullanım (mobil)

### Servis import

```javascript
import { scanPaperMrz, scanPaperMrzFromUri } from '../services/paperMrzService';
```

### Base64 ile

```javascript
const result = await scanPaperMrz(base64String);
if (result.success && result.parsed) {
  // result.text   → ham MRZ metni
  // result.parsed → { surname, givenName, documentNumber, birthDate, expiryDate, format, ... }
  // result.validation.passed, result.strategy, result.score
}
```

### Galeri / kamera URI ile

```javascript
const result = await scanPaperMrzFromUri(photoUri);
// photoUri = file://... veya content://...
```

## 4. Mevcut akışa entegrasyon (isteğe bağlı)

- **MRZ kamera ekranı:** Kağıt/fotokopi modunda (galeriden seçim veya “kağıt” seçeneği) `scanPaperMrzFromUri(uri)` veya `scanPaperMrz(base64)` çağrılabilir; sonuç mevcut MRZ sonuç ekranına verilir.
- **Galeri belge ekranı:** Tek belge seçildiğinde, “Kağıt MRZ oku” butonu eklenip `scanPaperMrzFromUri(selectedUri)` ile aynı servis kullanılabilir.

## 5. API özeti

| Öğe | Değer |
|-----|--------|
| URL | `POST /api/paper-mrz` |
| Auth | Bearer token (tesis/supabase) |
| Body | `{ "imageBase64": "..." }` |
| Cevap | `success`, `text`, `parsed`, `confidence`, `strategy`, `resolution`, `validation`, `score` |

## 6. Sorun giderme

- **401:** Giriş yapılmamış veya token geçersiz → Uygulama ile tekrar giriş yapın.
- **Sunucu adresi eksik:** `EXPO_PUBLIC_BACKEND_URL` tanımlı değil veya yanlış.
- **500 / timeout:** Görüntü çok büyük veya backend’de Tesseract/Jimp yükü; görüntüyü küçültüp (örn. max 1200px) tekrar deneyin.
