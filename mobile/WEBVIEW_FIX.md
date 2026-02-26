# WebView Native Modül Hatası - Çözüm

## 🔴 Sorun
`RNCWebViewModule could not be found` hatası alıyorsunuz.

## ✅ Çözüm Adımları

### 1. Paketi Expo ile Yükle (Zaten yüklü)
```bash
npx expo install react-native-webview
```

### 2. Native Build Dosyalarını Oluştur
```bash
npx expo prebuild
```

### 3. Android Build Al
```bash
npx expo run:android
```

## ⚠️ ÖNEMLİ

**Expo Go ile çalışmaz!** WebView native modül gerektirir.

- ❌ `expo start` (Expo Go) → ÇALIŞMAZ
- ✅ `npx expo run:android` (Custom build) → ÇALIŞIR
- ✅ `npx expo start --dev-client` (Dev client) → ÇALIŞIR

## 🔧 Alternatif: EAS Build

Eğer fiziksel cihazda test edecekseniz:

```bash
eas build --profile development --platform android
```

Sonra:
```bash
eas build:run -p android
```

## 📝 Notlar

- `app.config.js` dosyasına `react-native-webview` plugin'i eklendi
- Native modüller için her zaman custom build gerekir
- Expo Go sadece Expo SDK içindeki modülleri destekler

