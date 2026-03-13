# MRZ Kamera Sistemi ve Neden Açılmayabilir?

## Sistem Nasıl Çalışıyor?

### 1. Hangi kamera kullanılıyor?
- **expo-camera** `CameraView` (unified flow). Native `MrzReaderView` artık **Android’de kullanılmıyor** (siyah ekran riski); sadece **iOS’ta** bazen native okuyucu gösteriliyor.
- Sabit: `USE_UNIFIED_AUTO_SCAN = true` → her zaman **expo-camera + periyodik çekim + backend OCR** akışı kullanılıyor.

### 2. Akış adımları (sırayla)

1. **Ekran açılır**  
   - `useFocusEffect` çalışır, `mounted.current = true`, `unifiedCameraError = false`, `unifiedCameraMountKey = 0`.

2. **İzin kontrolü**  
   - `useCameraPermissions()` (expo-camera) + `ImagePicker.getCameraPermissionsAsync()`.  
   - İzin **yoksa** izin ekranı gösterilir.  
   - İzin **varsa**: `permissionGrantedLocal` / `permission.granted` true, `setUnifiedCameraMountReady(true)` çağrılır (focus’ta ve/veya 400 ms sonra).

3. **Kamera bileşeninin gösterilmesi**  
   - `showCameraView = unifiedCameraMountReady`.  
   - `true` ise `<CameraView>` render edilir; `false` ise “Kamera hazırlanıyor…” placeholder’ı gösterilir.

4. **Layout**  
   - `unifiedCameraWrap` için `onLayout` tetiklenir.  
   - `width > 50 && height > 50` ise `UNIFIED_CAMERA_MOUNT_DELAY_MS` (Android 350 ms, iOS 150 ms) sonra tekrar `setUnifiedCameraMountReady(true)` çağrılır (zaten true olabilir).

5. **Kamera “hazır” sayılması**  
   - **onCameraReady** gelirse: `unifiedCameraReady = true`, timeout’lar iptal.  
   - **iOS’ta** `onCameraReady` sıklıkla gelmez; bu yüzden **2,5 saniye** sonra “optimistik hazır”: `unifiedCameraReady = true` yapılır, 10 saniyelik hata timeout’u iptal edilir.  
   - **Android’te** 10 saniye içinde `onCameraReady` gelmezse: “Kamera açılamadı” ekranı gösterilir (Galeriden seç / Tekrar dene).

6. **onMountError**  
   - Native kamera açılamazsa (başka uygulama kullanıyor, izin reddi, sürücü hatası vb.) tetiklenir.  
   - **Android**: En fazla **3 deneme** (key 0→1→2), her seferinde gecikmeyle yeniden mount.  
   - Hâlâ hata varsa: “Kamera açılamadı” + Toast.

7. **Çekim ve OCR**  
   - `unifiedCameraReady === true` olunca periyodik aralıklarla (`UNIFIED_CAPTURE_INTERVAL_MS` ≈ 1800 ms) `takePictureAsync` ile fotoğraf alınır, base64 backend’e gönderilir, `POST /ocr/document-base64` ile MRZ okunur.

---

## Kamera Neden Açılmayabilir? (Kontrol Listesi)

| Olası neden | Ne yapılır? |
|-------------|-------------|
| **İzin verilmedi** | İlk girişte “Kamera izni gerekli” ekranı çıkar. İzin verilmezse CameraView hiç mount edilmez. Ayarlar → Uygulama → Kamera kapalıysa açın. |
| **unifiedCameraMountReady false kalıyor** | Sadece izin grant olduğunda true yapılıyor. İzin sonradan kapatıldıysa veya `useFocusEffect` / `ImagePicker.getCameraPermissionsAsync` hata veriyorsa mount hiç başlamaz; ekran “Kamera hazırlanıyor…”da kalır. |
| **onLayout geç geliyor / boyut geçersiz** | `onLayout` içinde `width > 50 && height > 50` koşulu var. Layout 0x0 veya çok küçük gelirse bu bloktaki `setUnifiedCameraMountReady(true)` çağrılmaz. Zaten focus’ta true yapılıyorsa sorun olmaz; yoksa ekran boş/siyah kalabilir. |
| **expo-camera native hata (onMountError)** | Başka uygulama kamerayı kullanıyordur, simülatörde gerçek kamera yoktur veya sürücü hatası vardır. “Kamera açılamadı” + Toast görülür. Gerçek cihazda deneyin, diğer kamera uygulamalarını kapatın. |
| **iOS: onCameraReady gelmiyor** | Normal; 2,5 saniye sonra “optimistik hazır” ile devam edilir. Bu süre içinde ekran siyah kalabilir, 2,5 s sonra otomatik hazır sayılır. 10 saniyelik timeout iOS’ta bu yüzden neredeyse hiç devreye girmez. |
| **Android: 10 saniye timeout** | Yavaş cihazda kamera 10 saniyede hazır olmazsa “Kamera açılamadı” çıkar. “Kamerayı tekrar dene” ile key sıfırlanıp yeniden mount denenir. |
| **Simülatör** | Gerçek kamera yok; expo-camera açılmayabilir veya siyah kalır. **Mutlaka gerçek cihazda** test edin. |
| **Expo Go** | Bazı native kamera davranışları farklıdır. **Development build** (`npx expo run:ios` / `eas build`) ile deneyin. |
| **expo-camera sürümü / rebuild** | `expo-camera` veya ilgili native bağımlılık güncellendiyse **projeyi yeniden build** edin (`npx expo run:ios` veya `eas build`). Eski binary bazen yeni kodu tam yansıtmaz. |

---

## Hızlı Debug (Loglar)

- `[MRZ-KAMERA] useFocusEffect FOCUS GAIN` → Ekran odaklandı.  
- `permissionExpo: true`, `permissionGrantedLocal: true` → İzin var.  
- `showCameraView: true` → CameraView render ediliyor (unifiedCameraMountReady && unifiedWrapLaidOut).  
- `unifiedCameraReady: false` → Henüz “hazır” sayılmadı (onCameraReady veya iOS’ta 2,5 s bekleniyor).  
- `[MRZ-KAMERA] iOS: onCameraReady gelmedi, optimistik hazır kabul` → iOS’ta 2,5 s doldu, kamera kullanılabilir sayıldı.  
- `[MRZ-KAMERA] CameraView onMountError` → Native kamera açılamadı; mesajda sebep olabilir.  
- `[MRZ-KAMERA] onCameraReady gelmedi (siyah ekran)` → Android’de 10 s timeout; “Kamera açılamadı” ekranı gösterildi.

Bu loglarla hangi adımda takıldığını (izin, mount, ready, onMountError) net görebilirsiniz.
