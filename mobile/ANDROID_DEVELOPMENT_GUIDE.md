# Android Geliştirme Kılavuzu - MyKBS Mobile

## 📱 Android Geliştirme Ortamı Kurulumu

### 1. Gereksinimler
- **Node.js** (v18 veya üzeri)
- **Java JDK** (17 veya üzeri)
- **Android Studio** (en son sürüm)
- **Android SDK** (API 34)
- **Android Build Tools** (34.0.0)

### 2. Android Studio Kurulumu
1. [Android Studio](https://developer.android.com/studio) indirin ve kurun
2. Kurulum sırasında "Android Virtual Device (AVD)" seçeneğini işaretleyin
3. SDK Manager'dan aşağıdakileri kurun:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0
   - Android Emulator
   - Android SDK Platform-Tools

### 3. Ortam Değişkenleri
Sistem ortam değişkenlerini ayarlayın:

```powershell
# JAVA_HOME
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"

# ANDROID_HOME
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# PATH'e ekle
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools;$env:ANDROID_HOME\tools\bin;$env:JAVA_HOME\bin;$env:PATH"
```

### 4. Proje Bağımlılıkları
```bash
cd mobile
npm install
```

## 🚀 Android Build İşlemleri

### 1. Development Build (Hızlı Test)
```powershell
# PowerShell ile
.\build-dev-android.ps1

# Veya manuel
cd mobile
npx expo run:android
```

### 2. EAS Build ile Cloud Build
```bash
# EAS CLI kurulumu (henüz yoksa)
npm install -g eas-cli

# Expo hesabına giriş
eas login

# Development build
eas build --profile development --platform android

# Preview build
eas build --profile preview --platform android

# Production build
eas build --profile production --platform android
```

### 3. Manuel APK Oluşturma
```bash
cd mobile/android
./gradlew assembleDebug  # Debug APK
./gradlew assembleRelease  # Release APK
```

## 📱 Android Emulator Kullanımı

### 1. Emulator Oluşturma
```bash
# Android Studio'da AVD Manager'ı açın
# Yeni sanal cihaz oluşturun:
# - Device: Pixel 6
# - System Image: API 34 (Android 14)
# - Play Store: İşaretli
```

### 2. Emulator Başlatma
```powershell
# PowerShell ile
emulator -avd Pixel_6_API_34

# Veya Android Studio'dan başlatın
```

### 3. Uygulamayı Emulator'a Yükleme
```bash
cd mobile
npx expo run:android
# Expo otomatik olarak emulator'ı bulacak ve uygulamayı yükleyecek
```

## 🔧 Android Özel Konfigürasyonları

### 1. AndroidManifest.xml Özellikleri
Projemizde aşağıdaki izinler mevcut:
- `CAMERA` - Kimlik fotoğrafı çekmek için
- `NFC` - Kimlik okumak için
- `INTERNET` - API bağlantıları için
- `READ/WRITE_EXTERNAL_STORAGE` - Dosya işlemleri için
- `USE_BIOMETRIC/FINGERPRINT` - Biyometrik kimlik doğrulama

### 2. Network Security Config
Android 9+ için network güvenlik konfigürasyonu:
```xml
<!-- mobile/android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">192.168.2.181</domain>
        <domain includeSubdomains="true">10.0.2.2</domain>
    </domain-config>
</network-security-config>
```

### 3. Gradle Konfigürasyonu
- **compileSdkVersion**: 34
- **targetSdkVersion**: 34
- **minSdkVersion**: 21
- **kotlinVersion**: 1.9.24

## 🐛 Sorun Giderme

### 1. "SDK location not found" Hatası
```powershell
# local.properties dosyası oluşturun
echo "sdk.dir=$env:LOCALAPPDATA\Android\Sdk" > mobile/android/local.properties
```

### 2. "Java version" Hatası
```powershell
# Java versiyonunu kontrol edin
java -version

# JAVA_HOME'u doğru ayarlayın
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
```

### 3. Emulator Bağlantı Sorunları
```bash
# ADB cihazlarını listele
adb devices

# Emulator'ı yeniden başlat
adb kill-server
adb start-server

# Port açma (USB debugging için)
adb tcpip 5555
```

### 4. Build Hatası: "Failed to install the app"
```bash
# Cache temizleme
cd mobile/android
./gradlew clean

# Node modules temizleme
cd ..
rm -rf node_modules
npm install

# Metro server'ı yeniden başlat
npx expo start --clear
```

## 📊 Test Senaryoları

### 1. Temel Fonksiyon Testleri
- [ ] Uygulama başlatma
- [ ] Login/Register işlemleri
- [ ] NFC okuma (cihaz destekliyorsa)
- [ ] Kamera erişimi
- [ ] API bağlantıları
- [ ] Push notification'lar

### 2. Cihaz Uyumluluk Testleri
- [ ] Farklı ekran boyutları
- [ ] Farklı Android versiyonları (21+)
- [ ] Karanlık/Aydınlık mod
- [ ] Dikey/Yatay mod

### 3. Performans Testleri
- [ ] Uygulama başlangıç süresi
- [ ] Bellek kullanımı
- [ ] Batarya tüketimi
- [ ] Ağ performansı

## 🔄 CI/CD Pipeline

### 1. GitHub Actions (Örnek)
```yaml
name: Android Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: eas build --platform android --profile preview --non-interactive
```

### 2. Firebase App Distribution
```bash
# EAS build + Firebase dağıtımı
eas build --profile preview --platform android
eas submit --platform android --latest
```

## 📱 Fiziksel Cihaz Testi

### 1. USB Debugging Aktif Etme
1. Cihazda **Geliştirici Seçenekleri** açın
2. **USB Debugging** aktif edin
3. Bilgisayara bağlayın
4. İzin isteği geldiğinde onaylayın

### 2. APK Yükleme
```bash
# Build alın
eas build --profile development --platform android

# APK'yı indirin ve cihaza yükleyin
adb install app-debug.apk
```

### 3. Log Takibi
```bash
# Android log'larını görüntüle
adb logcat

# Sadece React Native log'ları
adb logcat *:S ReactNative:V ReactNativeJS:V

# Belirli tag ile filtrele
adb logcat -s "MyKBS"
```

## 🎯 En İyi Uygulamalar

### 1. Performans Optimizasyonu
- Görselleri optimize edin
- Gereksiz re-render'ları önleyin
- Code splitting uygulayın
- Lazy loading kullanın

### 2. Güvenlik
- API key'leri environment variables'da saklayın
- HTTPS kullanın
- Sensitif verileri Secure Storage'da saklayın
- Biyometrik authentication implement edin

### 3. Kullanıcı Deneyimi
- Offline mod desteği
- Push notification'lar
- Deep linking
- App shortcuts

## 📞 Destek

Sorunlar için:
1. Expo dokümantasyonu: [docs.expo.dev](https://docs.expo.dev)
2. React Native dokümantasyonu: [reactnative.dev](https://reactnative.dev)
3. Android developer dokümantasyonu: [developer.android.com](https://developer.android.com)

---

**Not:** Bu kılavuz Windows ortamı için hazırlanmıştır. macOS veya Linux için bazı komutlar farklılık gösterebilir.
