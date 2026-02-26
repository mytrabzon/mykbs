# KYC Sistemi – Gerçek Okumalar İçin Durum Özeti

## Sistem ne yapıyor?

1. **MRZ (kamera)** – Pasaport veya kimliğin altındaki 2–3 satırlık makine okunabilir zona (MRZ) kamerayla taranıyor.
2. **Parse + doğrulama** – Okunan metin TD3 (pasaport) / TD1 (kimlik) formatına göre parse ediliyor; check digit ve tarih kontrolleri yapılıyor.
3. **Onay ekranı** – Kullanıcı sonucu görüp “Onayla ve devam et” diyor.
4. **Backend** – Sadece onay sonrası minimal alanlar (belge no, doğum, son kullanma, ülke) `POST /api/kyc/mrz-verify` ile sunucuya gidiyor; `kyc_verifications` tablosuna kayıt düşülüyor.
5. **NFC (V2 altyapı)** – Şu an sadece “NFC açık mı / destekleniyor mu?” kontrolü var. Çipli pasaport (ePasaport) gerçek okuması V2’de native modül ile eklenecek.

---

## Gerçek okumalar için hazır olanlar

| Bileşen | Durum | Açıklama |
|--------|--------|----------|
| MRZ parse (TD3/TD1) | Hazır | Check digit, tarih normalize, ülke/sex alanları |
| MRZ doğrulama | Hazır | Süre dolumu, format, zorunlu alanlar |
| MRZ tarama ekranı | Hazır | Kamera, overlay, 10 sn uyarı, 3 hata → manuel giriş |
| Sonuç + onay ekranı | Hazır | Maskeleme, “Tekrar tara” / “Onayla” |
| Manuel giriş (fallback) | Hazır | Belge no, doğum, son kullanma (NFC için) |
| Backend `/kyc/mrz-verify` | Hazır | Kayıt, `verification_id`, `status`, `next` |
| Veritabanı `KycVerification` | Hazır | passportLast4, birthDate, expiryDate, status |
| Log güvenliği | Hazır | MRZ ham veri maskeleme (`maskMrz`) |
| KYC flow (navigasyon) | Hazır | MrzScan → MrzResult → KycSubmit → NfcIntro |
| NFC “hazır mı?” ekranı | Hazır | Sadece kontrol; gerçek okuma yok |

---

## Gerçek okumalar için eksik / dikkat edilecekler

### 1. MRZ gerçek cihaz testi
- Kod ve akış hazır; **gerçek pasaport/kimlik + gerçek cihaz** ile test edilmedi.
- `@corupta/react-native-mrz-reader` native modül: **Expo Go’da çalışmaz**, mutlaka **development build** (EAS veya `expo run:android` / Xcode) gerekir.
- Android’de event yapısı (`onMRZRead`) pakete göre farklı olabilir; ilk testte log ile doğrula.

### 2. KYC’ye giriş noktası
- Uygulama içinde **“Kimlik doğrula” / “MRZ tara”** gibi bir buton henüz yok.
- Nereden açılacaksa (ör. Ayarlar, Check-in akışı) o ekranda:
  - `navigation.navigate('MrzScan')`
  eklenmeli.

### 3. NFC gerçek okuma (ePasaport)
- **Hazır değil.** Sadece altyapı var:
  - `react-native-nfc-manager` – genel NFC (açık/kapalı, destek).
  - `react-native-nfc-epassport-reader` – eski, production için roadmap’te **önerilmiyor**.
- Gerçek çip okuma (BAC, DG1/DG2, güvenli mesajlaşma) için roadmap’te **V2’de native modül** (iOS Swift + Android Kotlin) planlandı.

### 4. Backend Prisma client
- Şema ve migration (`db push`) uygulandı. Yerelde bazen `prisma generate` dosya kilidi hatası verebiliyor; sunucuda/CI’da tekrar `npx prisma generate` ve `npx prisma db push` çalıştırılmalı.

---

## Kısa cevap: “Gerçek okumalar için her şey hazır mı?”

- **MRZ (kamera) okuma:** Evet, **yazılım tarafı hazır**. Eksik olan:
  - Development build alıp **gerçek cihazda + gerçek belgeyle** test etmek,
  - Uygulama içinde **“MRZ tara” giriş noktası** eklemek (örn. `navigation.navigate('MrzScan')`).
- **NFC (çipli pasaport) gerçek okuma:** Hayır, **henüz hazır değil**. Sadece “NFC hazır mı?” ekranı ve paketler var; çip okuma V2’de native modül ile gelecek.

---

## Akış özeti (V1)

```
[MRZ Tara butonu] → MrzScan (kamera)
  → MRZ okundu → MrzResult (özet + onay)
  → Onayla → KycSubmit (POST /kyc/mrz-verify)
  → next: NFC → NfcIntro (“Telefonu pasaporta yaklaştır” – şimdilik sadece bilgi)
  → Tamamla → Main
```

3 başarısız taramada: **Manuel giriş** (belge no, doğum, son kullanma) → aynı KycSubmit → backend.
