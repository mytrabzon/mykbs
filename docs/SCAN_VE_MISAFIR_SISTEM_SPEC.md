# Tarama + Misafir/KBS Sistemi – Teknik Spec ve Görev Listesi

Bu doküman hedef sistemin özeti, API sözleşmeleri ve Cursor görev listesini içerir.

---

## 0. Proje Yapısı (Dosya Planı)

### Mobile – `mobile/src/features/scan/`

| Dosya | Açıklama |
|-------|----------|
| `ScanHome.tsx` | Pasaport / TR Kimlik / TR Ehliyet seçim |
| `ScanCameraScreen.tsx` | VisionCamera + overlay + auto-capture |
| `ScanReviewScreen.tsx` | Çekilen görüntü + parse sonucu, Onayla/Düzelt |
| `scan.types.ts` | DocType, MRZ result, API response tipleri |
| `scan.logger.ts` | Ring buffer (son 500 event) + PII mask |
| `scan.api.ts` | POST /scan/mrz/parse, /scan/doc/parse + correlationId |
| `scan.quality.ts` | blur / exposure / glare / stability skorları |
| `scan.autocapture.ts` | Gate + state machine (IDLE→SEARCHING→LOCKING→CAPTURING→…) |
| `mrz.parser.ts` | TD1/TD2/TD3 + check digit + autocorrect |
| `roi.templates.ts` | TR kimlik/ehliyet ROI koordinatları (sabit) |
| `scan.store.ts` | Zustand: state + lastResult + debug |

### Backend – `backend/src/`

| Alan | Dosya | Açıklama |
|------|--------|----------|
| Routes | `routes/scan/mrzParse.js` | POST /scan/mrz/parse |
| | `routes/scan/docParse.js` | POST /scan/doc/parse |
| Vision | `lib/vision/preprocess.js` | Deskew, threshold, crop (OpenCV/Jimp) |
| | `lib/vision/mrz.js` | MRZ crop + OCR + parser |
| | `lib/vision/tr_id.js` | TR kimlik ROI + OCR + field mapping |
| | `lib/vision/tr_dl.js` | TR ehliyet ROI + OCR + field mapping |
| Log | `lib/log/scanLog.js` | correlationId ile event yazma |
| Security | `lib/security/redact.js` | PII redaction (12******89) |

---

## 1. API Sözleşmesi

### 1.1 POST /scan/mrz/parse

**Body:**
- `imageBase64` (string, JPEG)
- `docTypeHint`: `"passport"` | `"id"` | `"unknown"`
- `correlationId` (string)

**Response:**
- `ok`: boolean
- `confidence`: 0..100
- `mrzRawMasked` (isteğe bağlı, maskeli)
- `fields`: documentNumber, nationality, surname, givenNames, birthDate (YYYY-MM-DD), sex, expiryDate, issuingCountry, optionalData
- `checks`: passportNoCheck, birthCheck, expiryCheck, compositeCheck (boolean)
- `errorCode` (varsa)

### 1.2 POST /scan/doc/parse

**Body:**
- `imageBase64` (string)
- `docType`: `"tr_id_front"` | `"tr_dl_front"` | `"unknown_front"`
- `correlationId` (string)

**Response:**
- `ok`: boolean
- `confidence`: 0..100
- `fields`: docType’a göre (TCKN, ad, soyad, doğum tarihi, seri no vb.)
- `errorCode` (varsa)

**Not:** Offline zorunlu değil; backend parse ana omurga.

---

## 2. Mobil Auto-Capture State Machine

- **State’ler:** IDLE → SEARCHING → LOCKING → CAPTURING → PROCESSING → DONE | FAILED
- **Frame skorları (0..1):** stabilityScore, blurScore, exposureScore, glareScore, docFoundScore, mrzCandidateScore (MRZ modunda)
- **Gate (çekim koşulu):**
  - docFoundScore > 0.75
  - stabilityScore > 0.85 en az 900ms
  - blurScore > 0.70
  - exposureScore > 0.60
  - glareScore < 0.35
  - MRZ modunda: mrzCandidateScore > 0.70
- **UI feedback:** parlama → “Parlama var…”, blur → “Telefonu sabitle”, doc yok → “Belgeyi çerçeveye hizala”

---

## 3. MRZ Parser (Mobil + Backend)

- **Mobil:** Vision (iOS) / ML Kit (Android) ile hızlı deneme; check digit + autocorrect; confidence < 90 ise backend’e gönder.
- **Confidence:** Tüm check geçti 95–100; 1 check fail + autocorrect 85–94; satır/uzunluk sorunlu < 70.

---

## 4. TR Kimlik + TR Ehliyet (Ön Yüz)

- Backend: doküman tespiti + perspektif düzeltme → standart boyut (örn 1024×640) → ROI kutuları → ROI başına OCR → format doğrulama (TCKN 11 hane + checksum, tarih regex).
- Confidence: ROI format doğrulama oranı + OCR confidence + Türkiye checksum.

---

## 5. Log / Telemetri

- **Mobil event’ler:** scan_opened, frame_quality (örnekleme 300ms), auto_capture_triggered, photo_captured, on_device_parse_done, backend_parse_requested, backend_parse_done, user_edit_used, scan_confirmed, scan_failed.
- **Backend event’ler:** preprocess_done, mrz_crop_done, ocr_done, parse_done, error.
- Her event: correlationId, userId, docType, deviceModel, appVersion, timings.
- **PII:** Log’a tam MRZ veya tam kimlik no yazılmaz; mask: 12******89.

---

## 6. Zorunlu Alanlar ve Müşteri Tipleri

| Müşteri tipi | Zorunlu alanlar |
|--------------|------------------|
| T.C. Vatandaşı | tc_kimlik_no |
| YKN olan Yabancı | ykn |
| Yabancı | passport_no, country |

**Devlet/KBS için zorunlular:** Ad, Soyad; Kimlik no (TC/YKN) veya Pasaport no; Doğum tarihi; Ülke; Oda no; Giriş tarihi; Kullanım şekli (konaklama | güniçi | depremzede).

---

## 7. Mimari: KBS Payload vs Otel İçi Profil

- **KBS’ye giden:** Sadece zorunlu alanlar; immutable audit.
- **Otel içi:** Guest profile + stay history; foto (thumbnail) + isim (opsiyonel) + oda geçmişi; 30 gün sonra silinir/anonymize.

---

## 8. Veritabanı (Hedef Şema – Supabase/Prisma)

- **hotels** (mevcut Tesis ile eşleştirilebilir)
- **hotel_staff:** hotel_id, user_id, role (owner|manager|staff), can_view_photos
- **guests:** hotel_id, display_name, photo_url, photo_blurhash, identity_hash (HMAC-SHA256: docType+docNo+birthDate), expires_at (created_at + 30 gün)
- **stays:** hotel_id, guest_id (nullable), room_no, check_in_at, check_out_at, usage_type, kbs_status, kbs_last_error, expires_at
- **kbs_submissions:** hotel_id, stay_id, citizenship_type, payload_json, sent_at, response_code, response_message, correlation_id

**Storage:** guest-photos (private), path: hotel/<id>/guest/<id>/thumb.jpg; 30 gün; signed URL; sadece can_view_photos.

---

## 9. Cursor Görev Listesi (Kopyala-Yapıştır)

**AMAÇ:** Mobilde VisionCamera ile auto-capture + MRZ on-device parse + backend fallback + TR kimlik/ehliyet ROI parse.

### 1) Mobile
- react-native-vision-camera ile ScanCameraScreen oluştur.
- scan.quality.ts: stability/blur/exposure/glare hesapları.
- scan.autocapture.ts: state machine + gate (900ms stabil).
- mrz.parser.ts: TD1/TD2/TD3 parse + check digit + autocorrect.
- scan.api.ts: POST /scan/mrz/parse ve /scan/doc/parse + correlationId header.
- scan.logger.ts: ring buffer (son 500 event) + mask PII.
- Review ekranı: fields edit + confirm.

### 2) Backend
- POST /scan/mrz/parse: preprocess + mrz crop + OCR + parser + confidence.
- POST /scan/doc/parse: docType=tr_id_front|tr_dl_front → preprocess + normalize + ROI OCR + format validation.
- Scan logs: correlationId ile event yaz, PII redaction uygula.

### 3) Acceptance
- MRZ: check digit full pass ise confidence ≥ 95.
- Mobil MRZ confidence < 90 ise backend zorunlu.
- TR kimlikte TCKN checksum doğrulaması geçmezse confidence düşür.
- Her taramada correlationId UI’da debug ekranında görünsün.
