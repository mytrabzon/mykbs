# 🧪 Test Modu Loglama Sistemi

## ✅ Eklenen Özellikler

### 1. Logger Utility (`src/utils/logger.js`)
- ✅ `logger.log()` - Genel loglar
- ✅ `logger.error()` - Hata logları
- ✅ `logger.warn()` - Uyarı logları
- ✅ `logger.info()` - Bilgi logları
- ✅ `logger.button()` - Buton tıklama logları
- ✅ `logger.api()` - API istek/yanıt logları

### 2. ErrorBoundary (`src/components/ErrorBoundary.js`)
- ✅ Çökme hatalarını yakalar
- ✅ Hata ekranı gösterir
- ✅ "Tekrar Dene" butonu
- ✅ Stack trace gösterimi

### 3. Login Screen Logları
- ✅ Screen mount/unmount logları
- ✅ Login butonu logları
- ✅ Form validation logları
- ✅ API istek logları
- ✅ Başarı/hata logları
- ✅ Başvuru butonu logları

### 4. CheckIn Screen Logları
- ✅ Screen mount/unmount logları
- ✅ NFC kontrol logları
- ✅ Oda yükleme logları
- ✅ Oda seçim butonu logları
- ✅ Okut butonu logları
- ✅ Manuel giriş butonu logları
- ✅ CheckIn butonu logları
- ✅ NFC okuma logları
- ✅ Kamera okuma logları
- ✅ OCR API logları

### 5. Odalar Screen Logları
- ✅ Screen mount/unmount logları
- ✅ Data yükleme logları
- ✅ Oda kartı tıklama logları
- ✅ Filtre butonu logları
- ✅ CheckIn FAB logları
- ✅ Action buton logları

### 6. API Interceptor Logları
- ✅ Tüm API istekleri loglanıyor
- ✅ Tüm API yanıtları loglanıyor
- ✅ Hata durumları loglanıyor
- ✅ 401 (Unauthorized) logları

### 7. AuthContext Logları
- ✅ Stored auth yükleme logları
- ✅ Login API logları
- ✅ Token kaydetme logları

## 📱 Console'da Görünecekler

### Buton Tıklamaları:
```
[BUTTON] Login Button clicked
[BUTTON] CheckIn FAB clicked
[BUTTON] Oda Select Button clicked
```

### API İstekleri:
```
[API] POST /auth/giris { tesisKodu: "...", telefon: "..." }
[API] GET /oda?filtre=bos
[API] POST /misafir/checkin { odaId: 1, ... }
```

### Genel Loglar:
```
[LOG] LoginScreen mounted
[LOG] Login attempt started
[LOG] Login successful
```

### Hatalar:
```
[ERROR] Login error caught { message: "...", ... }
[ERROR] API Response Error { status: 500, ... }
```

## 🔍 Test Modu

Test modu aktif: `TEST_MODE = true` (`src/utils/logger.js`)

Tüm loglar console'da görünecek. Production'da `TEST_MODE = false` yaparak kapatabilirsiniz.

## 🛡️ Çökme Engelleme

ErrorBoundary tüm uygulamayı sarmalıyor:
- React hatalarını yakalar
- Hata ekranı gösterir
- Uygulama çökmez
- "Tekrar Dene" ile reset edilebilir

## 📝 Örnek Log Çıktısı

```
[LOG] App started { timestamp: "2026-01-15T..." }
[LOG] LoginScreen mounted
[BUTTON] Login Button clicked
[LOG] Login attempt started { tesisKodu: "TEST", telefon: "555", pinLength: 4 }
[API] POST /auth/giris { tesisKodu: "TEST", telefon: "555", pinLength: 4 }
[API] POST /auth/giris { status: 200, hasToken: true }
[LOG] Login successful
```

## ⚙️ Test Modunu Kapatma

`src/utils/logger.js` dosyasında:
```javascript
const TEST_MODE = false; // Production için
```

