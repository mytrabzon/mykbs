# Kimlik ve Pasaport Okuma – Kurulu Paketler

## Kamera (MRZ – Makine Okunabilir Zona)

### @corupta/react-native-mrz-reader
- **Ne işe yarar:** Pasaport ve kimlik kartlarının arkasındaki MRZ (2 veya 3 satır) bölümünü kamerayla okur.
- **Platform:** iOS (TD3 pasaport, arka kamera) ve Android (belge no, son kullanma, doğum tarihi).
- **Kurulum:** Yüklü (`npm install @corupta/react-native-mrz-reader`).

**Örnek kullanım:**
```tsx
import MrzReader, { CameraSelector, DocType } from '@corupta/react-native-mrz-reader';

<MrzReader
  style={{ width: '100%', height: '100%' }}
  docType={DocType.Passport}
  cameraSelector={CameraSelector.Back}
  onMRZRead={(mrz) => console.log('MRZ:', mrz)}
/>
```

- **Not:** Native modül; **development build** (EAS veya `expo run:android`) gerekir, Expo Go’da çalışmaz.

---

## Kamera (genel)

### expo-camera
- **Ne işe yarar:** Kimlik/pasaport fotoğrafı çekmek, belge görüntüleme.
- **Durum:** Zaten kurulu ve `app.config.js` plugin’i mevcut.

---

## NFC (kimlik / pasaport çipi)

### react-native-nfc-manager
- **Ne işe yarar:** NFC açma/kapama, tag okuma.
- **Durum:** Kurulu ve `app.config.js` içinde plugin ile yapılandırılmış.

### react-native-nfc-epassport-reader
- **Ne işe yarar:** ePasaport (çipli pasaport) NFC okuma (BAC, veri grupları).
- **Durum:** Kurulu (`npm install react-native-nfc-epassport-reader`).
- **Not:** Eski paket (2021); tam uyumluluk için projede test edin. Gerekirse MRZ’den alınan belge no / doğum / son kullanma ile BAC anahtarı oluşturulur.

---

## Özet

| Amaç              | Paket                              | Durum   |
|-------------------|-------------------------------------|--------|
| MRZ (kamera)      | @corupta/react-native-mrz-reader    | Yüklü  |
| Kamera (genel)    | expo-camera                        | Yüklü  |
| NFC (genel)       | react-native-nfc-manager           | Yüklü  |
| NFC ePasaport     | react-native-nfc-epassport-reader  | Yüklü  |

Tümü native modül kullandığı için **Expo Go yerine development build** kullanılmalı.
