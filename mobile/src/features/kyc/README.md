# KYC Flow (MRZ + NFC Roadmap)

## V1 – MRZ (Kamera)
- **MrzScan** → **MrzResult** → **KycSubmit** → (opsiyonel) **NfcIntro**
- 3 başarısız denemede **KycManualEntry** (manuel belge no, doğum, son kullanma).
- MRZ ham veri cihazda kalıcı kaydedilmez; sadece onay sonrası server'a minimal alanlar gider.

## Giriş noktası
- `navigation.navigate('MrzScan')` (ör. Ayarlar veya ana ekrandan "Kimlik doğrula").

## Güvenlik
- Loglarda MRZ için `maskMrz(raw)` kullanın (`src/lib/security/maskMrz.js`).
- Server’a sadece: passportNumber, birthDate, expiryDate, issuingCountry.

## V2 – NFC
- **NfcIntroScreen** şu an sadece “NFC hazır mı?” kontrolü.
- Gerçek ePasaport okuma (BAC/DG1/DG2) ileride native modül ile yapılacak.
