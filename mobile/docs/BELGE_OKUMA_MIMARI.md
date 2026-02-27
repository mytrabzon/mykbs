# Belge Okuma Mimarisi (MRZ / OCR / NFC)

## Gerçekte Neyi Nasıl Okuyabilirsin?

### 1) Pasaport (en kolay ve sağlam)
- **MRZ:** Alt 2 satır okunur → %95+ başarı. Ad, soyad, pasaport no, doğum, uyruk, cinsiyet, son geçerlilik.
- **NFC:** Çip okuma %99 doğruluk; önce MRZ’dan **BAC key** üretmen gerekir. MRZ yoksa NFC genelde okuyamaz.

### 2) Kimlik (TR dahil) – orta zorluk
- **Ön/arka OCR + şablon:** Ön yüz OCR (ad, soyad, TCKN, doğum), arka MRZ/OCR (seri no). Başarı kamera ve ışığa bağlı.
- **NFC (e-ID):** Ülkeye göre değişir; çoğu senaryoda MRZ veya numara+doğum ile anahtar gerekir.

### 3) Ehliyet – en değişken
- **OCR:** Okunur ama layout ülkeye göre değişir. TR ehliyet için şablon; diğerleri için OCR + kullanıcı doğrulama.

---

## “Hiç Okumuyor” – Olası 6 Sebep

1. **Kamera preview var ama frame işleme yok** – MRZ/OCR pipeline tetiklenmiyor.
2. **MRZ için doğru crop yok** – MRZ sadece alt bant; full frame OCR MRZ’yi kaçırır.
3. **Odak/pozlama kilidi yok** – MRZ bulanık → 0 sonuç.
4. **Işık/kontrast yetersiz** – MRZ siyah-beyaz net değil.
5. **Expo Go vs Dev Client** – VisionCamera / MLKit / NFC native. Dev Client’ta doğru build edilmezse frame işleme çalışmaz.
6. **“Okunamadı” nedeni UI’da yok** – Aslında deniyor ama kullanıcı neden başarısız olduğunu görmüyor.

---

## Önerilen Mimari (KBS İçin)

### Katman 1: MRZ (pasaport + MRZ’li kimlik)
- Kamera ekranında **MRZ band overlay** (alt ~%25).
- **Auto-capture:** MRZ 2 satır stabil okununca veya **aynı değer 3 kez üst üste** gelince “çek”.
- MRZ parse + **checksum doğrula**.
- Sonuçları forma bas.

### Katman 2: OCR (kimlik / ehliyet)
- **Google MLKit Text Recognition** (on-device) veya backend OCR.
- Ön/arka için **şablon eşleme:** Kimlik (Ad, TCKN, Doğum, Belge No), Ehliyet (Ad, Doğum, Sınıf, Son Geçerlilik).
- OCR sonrası **doğrulama ekranı** (editable alanlar + confidence).

### Katman 3: NFC (pasaport çipi)
- MRZ okunduktan sonra **BAC key** üret.
- “Telefonu kapağa yaklaştır” + progress.
- Okuma başarısızsa **sebep kodu UI’da:** NFC kapalı / yanlış MRZ / uzak tutuldu vb.

### Debug
- Her modda **neden okunamadı** logla:
  - `cameraReady`, `permission`, `frameProcessorRunning`
  - `mrzDetectedCount`, `lastMrzValue`
  - `ocrTextLength`, `ocrLatencyMs`
  - `nfcStatus`, `errorCode`
- Kullanıcıya net mesaj: *“Okunamadı: Işık yetersiz / Bulanık / MRZ görünmüyor”*.

---

## Bu Projede Yapılanlar

- **DocumentHub:** Her kartın altında **başarı ipucu**; “Demo mod: örnek MRZ ile dene”; “Kamera test: netlik/ışık”.
- **MRZ:** **3 stabil okuma** (aynı MRZ 3 kez üst üste → auto-capture); **neden okunamadı** mesajları (check digit, format, ışık); **debug panel** (başlığa uzun basın: permission, lastMrz, checksReason, failCount, stableReadCount, ocrLatencyMs).
- **NFC:** “Önce MRZ okut, sonra NFC’ye geç”; BAC bilgisi; **nfcStatus** / **errorCode** UI alanları (okuma yapıldığında doldurulacak).
- **Kamera test ekranı:** Netlik/ışık kontrolü; Dev Client + Vision Camera notu.

## Sonraki Adımlar (İsteğe Bağlı)

- **react-native-vision-camera** + Frame Processor: Her frame’de MRZ crop (alt %25) analiz; 3 stabil okuma sonrası auto-capture.
- **MLKit Text Recognition:** On-device OCR; kimlik/ehliyet şablon eşleme; doğrulama ekranı.
- **NFC BAC + okuma:** MRZ’den BAC key üret; `react-native-nfc-manager` ile çip okuma; hata kodlarını UI’da göster.

Expo ile değil **development build (Dev Client)** ile test edin: VisionCamera, MLKit, NFC native modüllerdir; Expo Go’da frame işleme çalışmaz.
