# MRZ Okuma Sonrası Fotoğraf Çekme/Kaydetme Analiz Raporu

**Tarih:** 2026-03-11  
**Kapsam:** KBS Prime mobil uygulaması – MRZ okuma akışında fotoğrafın neden çekilmediği / kaydedilmediği / gösterilmediği.

---

## 1. Özet Bulgular

| Soru | Cevap |
|------|--------|
| MRZ okunduğunda fotoğraf neden çekilmiyor/kaydedilmiyor? | **Native MRZ yolu** (iOS @corupta/react-native-mrz-reader) sadece MRZ metnini döndürür; belge fotoğrafı çekilmez. **Android unified** yolu fotoğraf çeker ve backend’e gönderir ama **MrzResult** ekranına fotoğraf parametre olarak geçirilmez; **Kaydet** de fotoğraf göndermiyor. |
| Kamera görüntüsü backend’e gidiyor mu? | **Android unified** akışında evet (`/ocr/document-base64`). **iOS native** ve **manuel “Tekrar tara”** (galeri/kamera) dışındaki native MRZ okumada hayır. |
| Backend’de fotoğraf kaydediliyor mu? | Evet. `POST /api/okutulan-belgeler` gövdede `photoBase64` ve/veya `portraitPhotoBase64` gelirse Supabase Storage veya yerel `uploads/okutulan-belgeler` dizinine yazıyor. |
| Hangi durumlarda kaydediliyor / kaydedilmiyor? | **Kaydediliyor:** Check-in’e giderken `saveOkutulanBelgeAsync(..., docPhotoUri, portraitBase64)` çağrıldığında; Android unified sonrası aynı ekranda “Kaydet (Okutulan kimlikler)” ile. **Kaydedilmiyor:** Native MRZ → MrzResult → “Kaydet” (body’de foto yok); native MRZ → Check-in (saveOkutulanBelgeAsync’e `null` geçiliyor). |
| “Resim çekme” ile ilgili fonksiyonlar | `takePictureAsync` (unified + fallback kamera), `saveOkutulanBelgeAsync`, `handleKaydetOkutulan` (MrzResult), `onFrontPhotoTaken`, `uploadImageForDocument`, `uploadImageForMrz`, `captureFrontAndOcr`. |
| Fotoğraf kaydedilse bile neden gösterilmiyor olabilir? | MrzResult’a `photoUri` / `portraitBase64` hiç verilmiyor. Kaydedilenler listesinde ise `photoUrl` / `portraitPhotoUrl` API’den dönüyorsa gösterilir; kayıt sırasında foto gönderilmediyse liste ve detayda resim boş kalır. |

---

## 2. İncelenen Dosyalar ve Akışlar

### 2.1 `mobile/src/features/kyc/MrzScanScreen.js`

- **MRZ kaynağı:**
  - **iOS / native:** `MrzReaderView` (onMrzRead) → sadece ham MRZ string.
  - **Android:** `USE_UNIFIED_AUTO_SCAN = true` → periyodik `takePictureAsync` + `POST /ocr/document-base64` (belge + isteğe bağlı portrait dönüyor).
- **saveOkutulanBelgeAsync(payload, photoUri, portraitBase64):**
  - `photoUri` varsa dosyadan base64 okuyup `body.photoBase64` yapıyor.
  - `portraitBase64` veya `payload.chipPhotoBase64` varsa `body.portraitPhotoBase64` yapıyor.
  - `api.post('/okutulan-belgeler', body)` ile gönderiyor.
- **Native MRZ kabul edildiğinde (acceptAndNavigate):**
  - `setFrontImageUri(null)` ve `setMergedPayload(null)` yapılıyor.
  - Check-in’e gidiyorsa: `saveOkutulanBelgeAsync(..., null)` → **fotoğraf hiç gönderilmiyor.**
  - Check-in değilse: `navigation.replace('MrzResult', { payload: p, scanDurationMs })` → **photoUri / portraitBase64 parametre olarak verilmiyor.**
- **Android unified başarılı olduğunda:**
  - `setFrontImageUri(photo?.uri)`, `setPortraitBase64(data?.portraitBase64)` ve `setInstantPayload` / `setMergedPayload` yapılıyor; ekran değişmiyor, aynı ekranda “anlık sonuç” kartı gösteriliyor.
  - Bu karttaki “Kaydet (Okutulan kimlikler)” → `handleKaydetOkutulan` → state’teki `frontImageUri` ve `portraitBase64` kullanılıyor; bu path’te fotoğraf backend’e gidebiliyor.
- **goToCheckIn** (Check-in’e geçerken):
  - `docPhotoUri = frontImageUri || photoUri` ve `portraitBase64` ile `saveOkutulanBelgeAsync` çağrılıyor; bu path’te foto kaydediliyor (state’te uri/base64 varsa).

### 2.2 `mobile/src/features/kyc/MrzResultScreen.js`

- **route.params:** Sadece `payload`, `scanDurationMs`, `fromNfc` kullanılıyor; **photoUri / portraitBase64 / photoBase64 yok.**
- **handleKaydetOkutulan:**
  - Body: `belgeTuru`, `ad`, `soyad`, `kimlikNo`, `pasaportNo`, `belgeNo`, `dogumTarihi`, `uyruk`.
  - **photoBase64 veya portraitPhotoBase64 eklenmiyor.** Bu yüzden native MRZ → MrzResult → Kaydet akışında backend’e fotoğraf hiç gitmiyor.

### 2.3 `mobile/src/services/api.js` / API katmanı

- `api` (apiSupabase veya mevcut API client) ile `post('/ocr/document-base64', ...)` ve `post('/okutulan-belgeler', body)` çağrıları yapılıyor. Fotoğrafın gidip gitmemesi tamamen gönderilen body’ye bağlı (base64 alanları).

### 2.4 `backend/src/routes/ocr.js`

- **POST /ocr/document-base64:** Gelen `imageBase64` ile geçici dosya oluşturuluyor, MRZ pipeline + ön yüz OCR çalışıyor, `cropPortraitFromDocument(filePath)` ile kimlik portresi kırpılıp base64 üretiliyor. Cevapta `portraitBase64` dönülüyor.
- **POST /ocr/mrz** (FormData image): MRZ + isteğe bağlı portrait üretiliyor.
- **POST /ocr/document** (FormData): Ön yüz OCR + merged payload; portrait üretilip cevaba ekleniyor.
- Yani backend tarafında belge fotoğrafı işleniyor ve portrait üretilip cevaba konuyor; kayıt işlemi ocr.js içinde değil, okutulan-belgeler route’unda.

### 2.5 `backend/src/routes/okutulanBelgeler.js`

- **POST /api/okutulan-belgeler:** Body’den `photoBase64` ve `portraitPhotoBase64` alınıyor.
  - Varsa `saveBase64ToStorage` ile Supabase Storage’a (`okutulan-belgeler/{tesisId}/...`) veya yerel `uploads/okutulan-belgeler` dizinine yazılıyor.
  - Kayıtta `photoUrl` ve `portraitPhotoUrl` (veya sadece biri) set ediliyor.
- **GET /api/okutulan-belgeler:** Listedeki her kayıt için `photoUrl` ve `portraitPhotoUrl` dönülüyor (signed URL vb. ile). Yani kayıt sırasında foto gönderildiyse listede/detayda gösterilebilir.

### 2.6 `backend/src/lib/vision/documentOcr.js`

- Belge ön yüzü OCR (Tesseract + parseIdentityDocument) için kullanılıyor; doğrudan fotoğraf kaydetme yok. Fotoğraf kaydı sadece okutulanBelgeler route’unda.

### 2.7 `backend/src/lib/vision/preprocess.js`

- **cropPortraitFromDocument(filePath):** Belge görselinden yüz bölgesini kırpıp base64 döndürüyor. OCR route’ları bu fonksiyonu kullanıp cevaba `portraitBase64` ekliyor.

---

## 3. Akış Özeti (Ne Zaman Foto Var / Yok)

| Akış | Foto çekiliyor mu? | Backend’e gidiyor mu? | Okutulan-belgelere kaydediliyor mu? | Listede/ekranda gösteriliyor mu? |
|------|---------------------|------------------------|-------------------------------------|-----------------------------------|
| iOS native MRZ → MrzResult → Kaydet | Hayır | Hayır | Hayır | Hayır |
| iOS native MRZ → Check-in | Hayır | Hayır | Hayır (saveOkutulanBelgeAsync(..., null)) | - |
| Android unified → anlık kart → Kaydet | Evet | Evet | Evet (state’ten frontImageUri/portraitBase64) | Aynı ekranda evet |
| Android unified → Onayla (KycSubmit) | Evet (state’te var) | KycSubmit’e foto geçirilmiyorsa kayıt path’ine bağlı | goToCheckIn ile gidilmediyse eksik kalabilir | - |
| Galeri/kamera seç → document-base64 → sonuç | Evet | Evet | Sadece goToCheckIn / aynı ekranda Kaydet ile | State’te varsa evet |
| NFC → MrzResult | NFC çip fotoğrafı (chipPhotoBase64) | Kaydet’te body’de yok | MrzResult Kaydet foto göndermiyor | fromNfc payload’da chipPhotoBase64 varsa ekranda gösterilebilir |

---

## 4. Kök Nedenler (Özet)

1. **Native MRZ path’inde belge fotoğrafı yok:** Native okuyucu sadece MRZ string veriyor; ekstra bir “belge çekimi” veya “MRZ anındaki kare” alınmıyor.
2. **MrzResult’a fotoğraf taşınmıyor:** `navigation.replace('MrzResult', { payload, scanDurationMs })` ile photoUri/portraitBase64 (veya base64) parametre olarak verilmiyor.
3. **MrzResultScreen “Kaydet” fotoğraf göndermiyor:** Body’ye `photoBase64` / `portraitPhotoBase64` eklenmiyor; route’tan da gelmiyor.
4. **Check-in’e giderken native path’te fotoğraf yok:** `saveOkutulanBelgeAsync(..., null)` ile açıkça fotoğraf atlanıyor.

---

## 5. Önerilen Düzeltmeler (Kısa)

1. **Native MRZ sonrası fotoğraf almak (opsiyonel):** MRZ okunduktan hemen sonra tek kare `takePictureAsync` (veya mevcut kamera ref ile) alıp bu URI/base64’ü sonraki adıma taşımak. Platform kısıtı (native reader ekranı vs.) varsa en azından “ön yüz çek” adımı zorunlu kılınabilir.
2. **MrzResult’a fotoğraf parametreleri eklemek:** `navigation.replace('MrzResult', { payload, scanDurationMs, photoUri, portraitBase64 })` (veya base64 string’leri). MrzResultScreen’de bu parametreleri okuyup “Kaydet” body’sine `photoBase64` / `portraitPhotoBase64` eklemek.
3. **Check-in path’inde fotoğraf kullanmak:** Native MRZ + Check-in’de mümkünse aynı “MRZ sonrası tek kare” veya ön yüz çekimini `saveOkutulanBelgeAsync`’e geçirmek; en azından `null` yerine varsa uri/base64 kullanmak.
4. **NFC → MrzResult:** NFC’den gelen `chipPhotoBase64`’ü MrzResult’a parametre olarak verip, “Kaydet”te `portraitPhotoBase64` olarak body’e eklemek (şu an MrzResult Kaydet’te hiç foto yok).

Bu rapor, mevcut kod incelemesine dayanmaktadır; değişiklik yapıldıkça ilgili akışların tekrar test edilmesi gerekir.
