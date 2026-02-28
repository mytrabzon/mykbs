# MRZ / Belge Tarama – En İyi Sistem Önerisi

**Hedef:** Pasaport, kimlik, ehliyet — ön bilgi (MRZ veya belge) görüldüğü anda otomatik yakalayan sistem.

---

## 1. Önerilen çözüm: **Scanbot SDK** (Data Capture)

| Özellik | Açıklama |
|--------|----------|
| **Otomatik yakalama** | Belge/MRZ çerçevede ve sabit olduğunda otomatik çeker. |
| **Desteklenen belgeler** | Pasaport (TD2/TD3), kimlik (TD1), ehliyet, vize (MRV-A/B). |
| **Platform** | React Native, iOS + Android. |
| **Entegrasyon** | Ready-to-Use UI ile 1 saatte entegre edilebilir. |
| **Lisans** | 7 gün ücretsiz deneme; sonrası yıllık sabit ücret (kullanım sınırı yok). |

- Site: https://scanbot.io/developer/react-native-data-capture/mrz-scanner/  
- Deneme: https://docs.scanbot.io/trial/  
- GDPR/CCPA uyumlu; veri cihazda işlenebilir.

**Ne zaman tercih edilmeli:** Profesyonel ürün, “görür görmez kapacak” davranış ve tek bir SDK ile pasaport/kimlik/ehliyet istiyorsanız.

---

## 2. Alternatif: **Vision Camera + Dynamsoft**

- **react-native-vision-camera** ile yüksek FPS kamera; frame processor ile kare kare işleme.
- **Dynamsoft** tarafında MRZ / belge algılama kütüphaneleri kullanılır.
- Örnek: [Vision Camera + Dynamsoft MRZ](https://www.dynamsoft.com/codepool/react-native-mrz-scanner-vision-camera.html).

**Artı:** Esnek, kendi UI’ınızı kurarsınız.  
**Eksi:** Kurulum ve bakım daha teknik; lisans maliyeti ayrı.

---

## 3. Mevcut projedeki yapı

| Bileşen | Durum |
|--------|--------|
| **@corupta/react-native-mrz-reader** | Development build’te canlı MRZ okur; **Expo Go’da çalışmaz** (native modül). |
| **Kamera fallback** | Expo Camera ile tek çekim → backend `/ocr/mrz` veya `/ocr/document` ile MRZ + ön yüz. |
| **Backend** | Tesseract + ön işleme; TD1 (kimlik), TD2, TD3 (pasaport) desteklenir. |

Mevcut fallback’e **“sabit tutunca otomatik çekim”** eklendi: “Otomatik yakala” açıldığında belgeyi sabit tutunca birkaç saniye sonra otomatik fotoğraf çekilir (ek SDK yok).

---

## 4. Karar rehberi

- **“Görür görmez kapacak” + pasaport/kimlik/ehliyet tek çözüm:**  
  → **Scanbot SDK** ile MRZ Scanner’ı entegre edin; otomatik yakalama ve RTU UI hazır.

- **Maliyet sıfır, mevcut backend kalsın:**  
  → **Kamera fallback + otomatik çekim** (sabit tutunca 2–3 sn sonra çeker) yeterli; ileride Scanbot’a geçebilirsiniz.

- **Tam kontrol, kendi UI + Vision Camera:**  
  → **Vision Camera + Dynamsoft** (veya benzeri) ile frame processor tabanlı MRZ/belge algılama.

---

## 5. Scanbot entegrasyonu (özet adımlar)

1. https://docs.scanbot.io/trial/ ile 7 günlük deneme lisansı alın.  
2. `@scanbot.io/react-native-sdk` (veya Data Capture MRZ paketi) kurun.  
3. Projede lisansı ayarlayın (App.js veya başlangıç).  
4. MRZ Scanner ekranında Ready-to-Use MRZ UI bileşenini kullanın; otomatik yakalama varsayılan davranıştır.  
5. Sonuç callback’inde gelen alanları (ad, soyad, belge no, doğum tarihi vb.) mevcut Check-in / KBS akışına bağlayın.

Detaylı adımlar: [Scanbot React Native MRZ Scanner](https://scanbot.io/developer/react-native-data-capture/mrz-scanner/).
