# Tüm Dünya Belgeleri Okuma Sistemi (KBS Prime)

Bu dokümanda profesyonel belge okuyucu (Regula Document Reader SDK) entegrasyonu ve mevcut MRZ fallback akışı anlatılır.

## Mimari Özet

- **Birincil (SDK yüklüyse):** Regula Document Reader — 16.000+ belge tipi, 254 ülke, MRZ + VIZ + barkod + NFC.
- **Fallback:** Mevcut MRZ altyapısı (expo-camera + backend OCR, `parseMrz`, TD1/TD2/TD3).
- **Doğrulama:** ICAO 9303 checksum ve tarih kontrolleri (`validateICAO`), çoklu kaynak karşılaştırma (`crossValidate`).

## Dosya Yapısı

| Dosya | Açıklama |
|-------|----------|
| `mobile/src/services/documentReader.js` | Regula SDK bridge; `isDocumentReaderAvailable()`, `initializeDocumentReader()`, `showScanner()`. SDK yoksa stub. |
| `mobile/src/features/kyc/UniversalDocumentScanner.js` | `scanDocument()`, `parseDocumentResult()`, `toMrzResultPayload()`, `scanWithFallback()`. |
| `mobile/src/lib/documentValidation.js` | `validateICAO()`, `crossValidate()` (MRZ/vizuel/NFC tutarlılık). |
| `mobile/src/features/kyc/MrzScanScreen.js` | "Tüm belgeler" butonu ve `handleProfessionalScan`; SDK varsa önce SDK, yoksa kamera/galeri. |

## Regula Document Reader Kurulumu

### 1. Paket

```bash
cd mobile
npm install react-native-regula-document-reader
# veya: yarn add react-native-regula-document-reader
```

Versiyon: [Regula Document Reader React Native](https://github.com/regulaforensics/react-native-document-reader) — güncel major (örn. 6.x) dokümantasyonuna göre seçin.

### 2. Lisans

- https://regulaforensics.com/ adresinden demo/production lisans alın.
- Bundle ID: **com.litxtech.kbsprime** (uygulama `app.config.js` içinde tanımlı).
- Lisansı uygulama başlangıcında (örn. `App.js` veya bir init ekranında) çağırın:

```javascript
import { initializeDocumentReader, isDocumentReaderAvailable } from './src/services/documentReader';

if (isDocumentReaderAvailable()) {
  const { initialized, error } = await initializeDocumentReader('REGULA_LICENSE_BASE64_OR_STRING');
  if (!initialized) console.warn('Document Reader init failed:', error);
}
```

Lisansı ortam değişkeni veya güvenli config’ten okumak önerilir; repoda saklamayın.

### 3. iOS (Expo / development build)

`ios/Podfile` (prebuild sonrası veya bare workflow’da) içine ekleyin:

```ruby
pod 'RegulaCommon', '~> 7.5'
pod 'DocumentReader', '~> 6.7'
pod 'DocumentReaderFullRFID', '~> 6.7'  # NFC için
```

Ardından:

```bash
cd ios && pod install && cd ..
```

### 4. Android

**Kök `android/build.gradle`** — `allprojects { repositories { ... } }` bloğuna:

```gradle
allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://www.jitpack.io' }
    // Regula Document Reader
    maven { url 'https://maven.regulaforensics.com/RegulaDocumentReader' }
  }
}
```

**`android/app/build.gradle`** — `dependencies` bloğuna:

```gradle
dependencies {
  // ... mevcut bağımlılıklar
  implementation 'com.regula.documentreader:fullrfid:6.7.+'
}
```

Versiyon numaralarını Regula dokümantasyonuna göre güncelleyin.

## Kullanım (Uygulama İçi)

- Kimlik / Pasaport ekranında (**MrzScan**):
  - **"Tüm belgeler"** (veya kamera açılamadığında **"Tüm belgeler (SDK)"**) butonu yalnızca `isDocumentReaderAvailable()` true ise görünür.
  - Tıklandığında `scanWithFallback()` çağrılır; SDK kendi tarayıcı UI’ını açar.
  - Başarılı okumada sonuç `toMrzResultPayload()` ile mevcut payload formatına çevrilir, `validateICAO()` uyarıları varsa Toast gösterilir; Check-in veya MrzResult ekranına yönlendirilir.
  - SDK yoksa veya tarama iptal/hata olursa kullanıcı aynı ekranda kalır; kamera veya galeri kullanılır.

## Veri Doğrulama

- **validateICAO(data):** MRZ checksum (belge no, doğum, son kullanma), süre dolumu, doğum/bitiş tarihi mantığı.
- **crossValidate(mrzData, visualData, nfcData):** Ad, soyad, belge no tutarlılığı (MRZ / görsel / NFC karşılaştırması). İleride NFC + MRZ birlikte kullanıldığında çağrılabilir.

## Test Edilecek Belge Matrisi

| Belge | Ülke | Format | Not |
|-------|------|--------|-----|
| Pasaport | Türkiye | TD3 | Son model çipli |
| Pasaport | Almanya | TD3 | EU |
| Pasaport | ABD | TD3 | Kitapçık |
| Kimlik | Türkiye | TD1 | Yeni çipli kimlik |
| Kimlik | Almanya | TD1 | EU kimlik kartı |
| Ehliyet | Türkiye | TD2 | MRZ’li yeni model |
| Ehliyet | ABD (California) | Barkodlu | PDF417 |
| Ehliyet | İngiltere | Fotokart | Görsel OCR ağırlıklı |

## Güvenlik ve Gizlilik

- Tüm işlemler **cihaz içinde (on-device)** yapılmalı; belge görüntüsü dış sunucuya gönderilmemelidir.
- GDPR / KVKK uyumu için kişisel veri akışı ve saklama politikası proje dokümantasyonunda belirtilmelidir.

## Alternatif SDK’lar

- **Smart Engines ID Scanning:** 2.989+ belge, 220 ülke; on-premise, veri göndermez; Türk kimlik kartlarında güçlü.
- **G2 Risk Solutions ID Verification:** 15.000+ belge, 138 dil; OCR + NFC + biyometrik paket.

Farklı bir SDK’ya geçişte yalnızca `documentReader.js` ve (gerekirse) `UniversalDocumentScanner.js` içindeki SDK çağrıları değiştirilir; `validateICAO`, `crossValidate` ve MrzResult/Check-in akışı aynı kalır.
