# KYC / Kimlik Doğrulama Akışı ve Veri Modeli

## 1. Alınan bilgiler (kaynaklara göre)

### A) Pasaport (MRZ + NFC)

| Alan | MRZ | NFC (e-Passport) |
|------|-----|------------------|
| Belge türü (P) | ✓ | ✓ (DG1) |
| Veren ülke | ✓ | ✓ |
| Soyad / Ad(lar) | ✓ | ✓ |
| Pasaport numarası | ✓ | ✓ (doğrulanmış) |
| Uyruk | ✓ | ✓ |
| Doğum tarihi | ✓ | ✓ |
| Cinsiyet | ✓ | ✓ |
| Son kullanma tarihi | ✓ | ✓ |
| Yüz fotoğrafı | — | ✓ (DG2) |

NFC varsa veri kalitesi artar; sahte MRZ/OCR ihtimali düşer.

### B) Türkiye Kimlik Kartı (kamera + MRZ/OCR)

- Ad, Soyad, T.C. Kimlik No (TCKN), Doğum tarihi, Belge seri no, Son kullanma tarihi, Uyruk.
- TR kimlikte NFC var ama uygulama çoğunlukla kamera okuma + doğrulama ile yapılır.

### C) Ehliyet (kamera OCR)

- Ad, Soyad, Doğum tarihi, Ehliyet numarası, Sınıf(lar) (B, C, D…), Veriliş / son kullanma tarihi, Veren ülke/otorite.

---

## 2. Form akışı (wireframe uyumu)

1. **Adım 1 — Belge seç + tara**
   - Belge türü: Pasaport / Kimlik / Ehliyet
   - Kamera: Ön/arka foto
   - MRZ tarama (pasaportta şart)
   - NFC oku (pasaportta opsiyonel)

2. **Adım 2 — Otomatik doldurma + onay**
   - Otomatik gelen alanlar **kilitli** (readonly)
   - "Düzenle (manuel)" ile açılır; düzenleme log’lanır

3. **Adım 3 — Selfie + rıza (opsiyonel)**
   - Selfie; isteğe bağlı canlılık / DG2 ile yüz eşleştirme
   - Telefon, e-posta, KVKK/GDPR rıza metni
   - Toplam alan sayısı minimum tutulur

---

## 3. Veritabanı (Supabase)

- **verification_sessions**: Bir doğrulama oturumu (started → document_captured → confirmed → verified/rejected).
- **verification_documents**: Belge özeti; `document_number_hash` (plaintext belge no yok), expiry, mrz_present, nfc_present, face_image_present, confidence_score.
- **verification_scans**: front/back/selfie/nfc_face; `storage_path_enc`, `purge_after` (X gün sonra silme).
- **verification_extracted_fields**: source (mrz | nfc | ocr), `fields_json_enc`, `mrz_raw_enc`, `nfc_dg1_raw_enc`, `nfc_dg2_face_ref_enc`.

Ham PII şifreli saklanır; loglarda tam belge no / TCKN basılmaz.

---

## 4. Normalize alan eşlemesi (documentFields.ts)

Tüm belgeler tek şemada toplanır:

- document_type, issuing_country, document_number_masked, given_names, surname, nationality, date_of_birth, sex, date_of_expiry, date_of_issue
- mrz_present, nfc_present, face_image_present, confidence_score, verification_status, source

MRZ → `mrzPayloadToNormalized()` ile bu alanlara map edilir. NFC/OCR için aynı arayüz kullanılır; `source` ile ayırt edilir.

---

## 5. Güvenlik

- Mobilde service_role kullanılmaz.
- Ham görüntü/NFC: encrypted at rest; erişim RLS/role bazlı.
- Loglarda tam belge no / TCKN yok; sadece hash veya masked.
- Rıza metni ve saklama süresi (örn 7–30 gün) net tanımlanır.
