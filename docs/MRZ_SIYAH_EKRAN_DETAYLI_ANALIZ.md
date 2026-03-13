# MRZ Kamera – Siyah Ekran Detaylı Analiz

## Senin durumun
- **Galeri** ve **fener** butonları görünüyor → Ekran izinli, kamera ekranına girilmiş, overlay’ler render ediliyor.
- **Kamera önizlemesi siyah** → `CameraView` muhtemelen mount ama **native önizleme çizilmiyor**.

---

## 1. Kamera ekranının açılma koşulları (sırayla)

Aşağıdakilerin **hepsi** true olmalı ki “kamera ekranı” (geri, galeri, fener butonları) görünsün:

| # | Koşul | Değişken | Açıklama |
|---|--------|----------|----------|
| 1 | İzin var | `permission?.granted \|\| permissionGrantedLocal` | expo-camera veya ImagePicker izin “granted” döndü. |
| 2 | İzin kontrolü bitti | `permissionCheckReady === true` | İlk 700 ms “İzin kontrol ediliyor” sonrası veya izin gelince true. |
| 3 | Hata yok | `unifiedCameraError === false` | onMountError tetiklenmedi. |
| 4 | Unified flow | `useUnifiedMrzFlow === true` | Sabit: `USE_UNIFIED_AUTO_SCAN = true`. |
| 5 | Mount hazır | `unifiedCameraMountReady === true` | useFocusEffect / onLayout / focus retry (100 ms) ile set ediliyor. |
| 6 | Layout alındı | `unifiedWrapLaidOut === true` | `unifiedCameraWrap` onLayout’ta width/height > 50. |
| 7 | View render izni (iOS) | `unifiedCameraViewAllowRender === true` | Android: hep true. iOS: 400 ms sonra true. |

**“Kamera görünüyor mu?” (CameraView’ın DOM’da olması):**

| # | Koşul | Sonuç |
|---|--------|--------|
| 8 | `showCameraView && unifiedCameraViewAllowRender` | true ise **CameraView** render edilir; false ise “Kamera hazırlanıyor…” placeholder. |

Senin durumda galeri/fener göründüğü için 1–7 genelde true; 8 de true → **CameraView mount**. Yani sorun “ekran açılmıyor” değil, **“CameraView mount ama önizleme siyah”**.

---

## 2. Neden siyah ekran? (CameraView var ama görüntü yok)

Olası nedenler:

### A) expo-camera native tarafı (en güçlü ihtimal)
- **expo-camera 16+ / 17** birçok cihazda iOS’ta **preview surface siyah** kalıyor; view mount oluyor, `onCameraReady` bazen gelmiyor veya geliyor ama ekran hâlâ siyah.
- Kaynak: [expo/expo#34300](https://github.com/expo/expo/issues/34300), [#34305](https://github.com/expo/expo/issues/34305) (Android/iOS siyah ekran).
- Yani: **React tarafı doğru**, sorun **expo-camera’nın native preview’ı çizmemesi**.

### B) Boyut / layout
- CameraView’a `StyleSheet.absoluteFill` + `unifiedCameraSize` (width/height: SCREEN_WIDTH/HEIGHT) veriliyor.
- Native tarafta bazen view **0x0** veya yanlış boyutta kalırsa preview siyah görünebilir.
- Kontrol: `unifiedCameraWrap` onLayout’ta `width > 50 && height > 50` ve log’da width/height dolu mu bak.

### C) Zamanlama
- iOS’ta CameraView’ı 400 ms gecikmeyle mount ediyoruz; bazen native kamera **daha geç** hazır oluyor.
- `onCameraReady` iOS’ta sık gelmediği için 3,5 saniye “optimistik hazır” kullanılıyor; bu sadece **çekim** için. Önizlemenin siyah olması yine native tarafla ilgili.

### D) Başka uygulama / izin
- Başka uygulama kamerayı tutuyorsa veya izin “Ask every time” ise bazen preview açılmaz.
- onMountError gelirse “Kamera açılamadı” ekranı çıkar; sen galeri/fener gördüğün için bu ekran yok → onMountError tetiklenmemiş.

---

## 3. Tüm MRZ ile ilgili hata / uyarı noktaları

| Yer | Ne oluyor | Olası hata / sonuç |
|-----|-----------|---------------------|
| İzin | `permission?.granted` / `permissionGrantedLocal` | İkisi de false → “Kamera İzni Gerekli”. ImagePicker/expo gecikirse yanlışlıkla izin yok gibi görünebilir (700 ms “İzin kontrol ediliyor” ile azaltıldı). |
| permissionCheckReady | İlk 700 ms false | Bu sürede “İzin vermedin” yerine “İzin kontrol ediliyor” gösteriliyor. |
| unifiedCameraMountReady | useFocusEffect / onLayout / 100 ms retry | false kalırsa “Kamera hazırlanıyor…” kalır, CameraView hiç mount olmaz. |
| unifiedWrapLaidOut | onLayout width/height > 50 | Layout 0 veya çok küçükse wrap “hazır” sayılmaz, yine placeholder. |
| unifiedCameraViewAllowRender (iOS) | 400 ms sonra true | iOS’ta 400 ms önce CameraView yok; siyah önleme amaçlı. |
| CameraView onMountError | Native kamera açılamadı | “Kamera açılamadı” + Galeriden seç / Tekrar dene. |
| onCameraReady gelmemesi (Android) | 4,5 s içinde gelmezse | unifiedCameraError = true, aynı hata ekranı. |
| iOS onCameraReady | Sık gelmez | 3,5 s “optimistik hazır” ile çekim yapılıyor; **önizleme** yine native’e bağlı. |
| takePictureAsync | Çekim / OCR | Ref null, izin yok veya unifiedCameraReady false ise çekim başlamaz. |
| Backend OCR | POST /ocr/document-base64 | Ağ/rate limit/400–500 hata → MRZ okunamaz, kullanıcı siyah ekranda kalabilir. |

---

## 4. Ne yapılabilir?

### Hemen deneyebileceğin
1. **Uygulamayı tam kapatıp aç** (arka planda bile çalışmasın).
2. **Başka kamera uygulaması açık mı** kapat.
3. **Development build** kullan: `npx expo run:ios` (Expo Go değil).
4. **Farklı cihaz / iOS sürümü** dene (expo-camera bazı sürümlerde sorunlu).

### Kod tarafında (denenebilir)
- **expo-camera** sürümünü sabitle: 16.0.14’te bazı siyah ekran düzeltmeleri var; 17’de regresyon olabilir.
- **CameraView’a flex:1** verip parent’a da flex:1 + net boyut ver; bazen absolute + width/height native’de 0 gibi işleniyor.
- **iOS’ta mount gecikmesini artır** (örn. 400 ms → 600 ms); nadiren işe yarar.
- **Galeriden seç** ile MRZ akışı çalışıyorsa sorun büyük ihtimalle **sadece canlı önizleme** (expo-camera native).

### Debug (geliştirme)
- Aşağıda ekranda **MRZ debug paneli** eklendi (sadece __DEV__). Açıkken şunlara bak:
  - `showCameraView`, `unifiedCameraViewAllowRender`, `unifiedCameraReady`, `unifiedCameraMountReady`, `unifiedWrapLaidOut`
  - Hepsi true ise ve ekran hâlâ siyah → sorun **expo-camera native preview** (yukarıdaki A maddesi).

---

## 5. Özet

- **Galeri + fener görünüyor, kamera siyah** → CameraView mount, overlay’ler doğru; **native kamera önizlemesi çizilmiyor**.
- Bu, **expo-camera** ile bilinen bir durum; çözüm genelde: sürüm/patches, layout (flex/boyut), bazen “Galeriden seç” fallback.
- Tüm “MRZ hataları” yukarıdaki tabloda; siyah ekran için asıl odak: **expo-camera native layer** ve **layout/boyut**.
