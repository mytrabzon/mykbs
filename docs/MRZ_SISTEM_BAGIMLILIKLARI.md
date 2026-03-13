# MRZ Sistemi – Dış Bağımlılıklar ve “Çalışan Sistemi Ne Bozdu?”

## Kısa cevap

- **Şu anki sistem (Unified):** Evet, **dış bağlantı gerekli** – uygulama fotoğrafı **backend’e** gönderiyor, MRZ orada çözülüyor. Backend erişilebilir olmazsa MRZ okuma tamamlanmaz.
- **Eski seçenek (Native):** Dış paket/backend **MRZ için gerekmez** – `@corupta/react-native-mrz-reader` MRZ’yi cihazda yapıyor. Ama bu yol şu an **kapalı** (siyah ekran nedeniyle).

---

## 1. Şu an hangi sistem kullanılıyor?

Kodda:

```ts
USE_UNIFIED_AUTO_SCAN = true;
```

Yani **Unified akış** açık:

1. **expo-camera** (CameraView) ile cihazda fotoğraf çekiliyor.
2. Foto base64 olarak **backend’e** gönderiliyor:  
   `POST /api/ocr/document-base64`
3. Backend MRZ + OCR yapıp cevabı dönüyor.
4. Uygulama bu cevaba göre sonucu gösteriyor.

**Gerekli dış bağlantı:** `EXPO_PUBLIC_BACKEND_URL` ile tanımlı sunucu. Bu adres erişilebilir değilse veya `/api/ocr/document-base64` yoksa MRZ akışı backend aşamasında hata verir.

---

## 2. Hangi “dış şeyler” var?

| Ne | Gerekli mi? | Açıklama |
|----|-------------|----------|
| **Backend (EXPO_PUBLIC_BACKEND_URL)** | Evet (Unified için) | MRZ/OCR bu sunucuda yapılıyor. Ağ + sunucu şart. |
| **expo-camera** | Evet | Kamera ve fotoğraf cihazda; paket npm’den, ekstra dış API yok. |
| **@corupta/react-native-mrz-reader** | Hayır (şu an) | Native MRZ için; şu an `USE_UNIFIED_AUTO_SCAN = true` olduğu için kullanılmıyor. |

Yani “dış paket bağlantısı” derken:

- **Paket (npm):** Sadece expo-camera ve (opsiyonel) @corupta – bunlar ekstra bir “dış API’ye bağlanan paket” değil.
- **Asıl dış bağlantı:** Backend sunucusu. Unified MRZ **mutlaka** backend’e istek atıyor.

---

## 3. “Çalışan sistemi” ne bozmuş olabilir?

İki mantıklı senaryo var:

### A) Eski sistem Native’dı (cihazda MRZ)

- **Eski:** `@corupta/react-native-mrz-reader` (MrzReaderView) – kamera + MRZ tamamen cihazda, **backend’e MRZ için ihtiyaç yok**.
- **Sorun:** Bu ekranda “siyah ekran” şikâyeti gelince **Unified’a geçildi** (expo-camera + backend OCR).
- **Sonuç:** “Çalışan sistem” aslında Native’dı; “bozulan” şey Native’ın kapatılıp Unified’a geçilmesi. Şu an gördüğün sorun büyük ihtimalle:
  - **expo-camera** (kamera açılmıyor / siyah), veya
  - **EAS build** farkı (native kamera davranışı),
  - **Backend** değil (backend zaten Unified’da hep vardı).

Yani hata büyük olasılıkla **yeni talimatlardaki bir “dış paket”e** değil, **Unified’a geçiş + expo-camera/build** tarafına işaret ediyor.

### B) Eski sistem zaten Unified’dı

- Unified (expo-camera + backend) daha önce çalışıyordu.
- O zaman bozan şunlar olabilir:
  - **expo-camera** sürüm değişikliği (örn. 17 → 16.0.14),
  - **EAS build** / farklı native ortam,
  - **EXPO_PUBLIC_BACKEND_URL** yanlış / değişti / erişilemiyor,
  - Ağ / firewall.

---

## 4. Ne yapılabilir?

1. **Backend’i doğrula:**  
   `.env` / ayarlarda `EXPO_PUBLIC_BACKEND_URL` doğru mu, tarayıcı veya Postman ile `POST .../api/ocr/document-base64` erişilebiliyor mu kontrol et.

2. **Kameranın açılması:**  
   Kamera hiç açılmıyorsa veya siyahsa sorun büyük ihtimalle **expo-camera / build** tarafında. Backend’ten bağımsız (foto çekilmeden istek de gitmez).

3. **İsteğe bağlı: Native’ı tekrar dene:**  
   Siyah ekran sadece belirli cihaz/build’deyse, geçici olarak `USE_UNIFIED_AUTO_SCAN = false` yapıp **sadece native MrzReaderView** ile test edebilirsin. Bu modda MRZ için **backend gerekmez**; sadece kamera + @corupta paketi kullanılır.

---

## Özet

- **MRZ için dış bağlantı:** Evet – **Unified** kullanıldığı sürece **backend (EXPO_PUBLIC_BACKEND_URL)** zorunlu.
- **Dış paket:** MRZ’yi “dış bir servise bağlayan” ekstra paket yok; backend kendi sunucun.
- **Çalışan sistemi bozma ihtimali:** Büyük olasılıkla **Native → Unified geçişi** veya **expo-camera / build**; “yeni eklenen bir dış paket bağlantısı” değil.
