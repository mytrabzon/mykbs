# Android Özel Sorunlar ve Çözümleri Kontrol Listesi

## ✅ Zaten Çözülmüş Konular

### 1. Platform-specific Keyboard Handling
- **Durum**: ✅ Çözüldü
- **Dosya**: `LoginScreen.js`, `KayitScreen.js`, `OTPVerifyScreen.js`
- **Çözüm**: `KeyboardAvoidingView` kullanılıyor
```javascript
behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
```

### 2. Font Family Ayarları
- **Durum**: ✅ Çözüldü
- **Dosya**: `src/theme/typography.js`
- **Çözüm**: Platform-specific font ayarları
```javascript
fontFamily: Platform.select({
  ios: 'System',
  android: 'Roboto',
})
```

### 3. NFC Implementation
- **Durum**: ✅ Çözüldü
- **Dosya**: `CheckInScreen.js`
- **Çözüm**: Expo Go ve development build için uygun hata yakalama
- **Android İzinleri**: `AndroidManifest.xml`'de NFC izni mevcut

### 4. Network Security Config
- **Durum**: ✅ Çözüldü
- **Dosya**: `android/app/src/main/res/xml/network_security_config.xml`
- **Çözüm**: HTTP trafiğine izin veren konfigürasyon
- **Kapsam**: localhost, 192.168.2.181, 10.0.2.2 (emulator)

## 🔧 Düzeltilmesi Gereken Konular

### 1. StatusBar Yönetimi
- **Durum**: ⚠️ Kontrol Edilecek
- **Sorun**: Android'de StatusBar rengi ve davranışı
- **Önerilen Çözüm**:
```javascript
import { StatusBar } from 'react-native';

// Android için
StatusBar.setBackgroundColor('#007AFF');
StatusBar.setBarStyle('light-content');
```

### 2. Back Button Handling
- **Durum**: ⚠️ Kontrol Edilecek
- **Sorun**: Android geri butonu yönetimi
- **Önerilen Çözüm**:
```javascript
import { BackHandler } from 'react-native';

useEffect(() => {
  const backAction = () => {
    // Özel geri butonu davranışı
    return true; // Varsayılan davranışı engelle
  };

  const backHandler = BackHandler.addEventListener(
    'hardwareBackPress',
    backAction
  );

  return () => backHandler.remove();
}, []);
```

### 3. Android Splash Screen
- **Durum**: ⚠️ Kontrol Edilecek
- **Sorun**: Splash screen süresi ve davranışı
- **Önerilen Çözüm**:
```javascript
// app.config.js'de splash screen ayarları
splash: {
  image: "./assets/splash.png",
  resizeMode: "contain",
  backgroundColor: "#007AFF"
}
```

### 4. Android Permissions
- **Durum**: ✅ Mevcut
- **İzinler**:
  - `CAMERA` - ✅ Mevcut
  - `NFC` - ✅ Mevcut
  - `INTERNET` - ✅ Mevcut
  - `READ_EXTERNAL_STORAGE` - ✅ Mevcut
  - `WRITE_EXTERNAL_STORAGE` - ✅ Mevcut
  - `RECORD_AUDIO` - ⚠️ Gerekli mi?
  - `USE_BIOMETRIC` - ✅ Mevcut
  - `USE_FINGERPRINT` - ✅ Mevcut

### 5. Android Specific UI Issues
- **Durum**: ⚠️ Test Edilecek
- **Potansiyel Sorunlar**:
  - Text input focus davranışı
  - ScrollView performansı
  - Touch feedback
  - Keyboard dismiss mode

## 🧪 Test Senaryoları

### 1. Temel Fonksiyon Testleri
- [ ] Uygulama başlatma (splash screen)
- [ ] Login/Register ekranları
- [ ] Keyboard davranışı
- [ ] Back button davranışı
- [ ] StatusBar görünümü

### 2. Permission Testleri
- [ ] Camera permission isteği
- [ ] NFC permission isteği (cihaz destekliyorsa)
- [ ] Storage permission isteği
- [ ] Biometric permission isteği

### 3. Platform-specific Testler
- [ ] Android 21+ uyumluluk
- [ ] Farklı ekran boyutları
- [ ] Karanlık mod desteği
- [ ] Emulator ve fiziksel cihaz testi

### 4. Performans Testleri
- [ ] Uygulama başlangıç süresi
- [ ] Bellek kullanımı
- [ ] Scroll performansı
- [ ] Network request'leri

## 🐛 Bilinen Sorunlar ve Çözümleri

### 1. Expo Go'da NFC Çalışmaması
- **Sorun**: Expo Go'da NFC API'leri çalışmaz
- **Çözüm**: Development build gerektir
- **Script**: `.\build-dev-android.ps1`

### 2. Network Connection Issues
- **Sorun**: API bağlantı sorunları
- **Çözüm**: `network_security_config.xml` doğru yapılandırıldı
- **Test**: `curl http://192.168.2.181:3000/health`

### 3. Android Build Failures
- **Olası Nedenler**:
  - Java versiyonu uyumsuzluğu
  - Android SDK eksiklikleri
  - Gradle cache sorunları
- **Çözümler**:
  ```bash
  # Cache temizleme
  cd android && ./gradlew clean
  
  # SDK kontrolü
  sdkmanager --list
  
  # Java kontrolü
  java -version
  ```

### 4. Emulator Connection Issues
- **Sorun**: Uygulama emulator'da çalışmıyor
- **Çözümler**:
  ```bash
  # ADB restart
  adb kill-server
  adb start-server
  
  # Emulator port
  adb connect localhost:5555
  
  # Metro restart
  npx expo start --clear
  ```

## 🔄 Güncelleme Planı

### 1. Acil Düzeltmeler
- [ ] StatusBar yönetimi (eğer sorun varsa)
- [ ] Back button handling (eğer gerekliyse)
- [ ] Splash screen optimizasyonu

### 2. İyileştirmeler
- [ ] Android-specific UI tweaks
- [ ] Performans optimizasyonları
- [ ] Battery optimization

### 3. Test Otomasyonu
- [ ] Android UI testleri
- [ ] Integration testleri
- [ ] Performance monitoring

## 📞 Destek Kaynakları

### 1. Expo Dokümantasyonu
- [Android Configuration](https://docs.expo.dev/guides/android-config/)
- [Building for Android](https://docs.expo.dev/build-reference/android-builds/)
- [Troubleshooting](https://docs.expo.dev/troubleshooting/common-issues/)

### 2. React Native Dokümantasyonu
- [Platform Specific Code](https://reactnative.dev/docs/platform-specific-code)
- [Android BackHandler](https://reactnative.dev/docs/backhandler)
- [Android Permissions](https://reactnative.dev/docs/permissionsandroid)

### 3. Android Developer Dokümantasyonu
- [App Manifest](https://developer.android.com/guide/topics/manifest/manifest-intro)
- [Network Security Config](https://developer.android.com/training/articles/security-config)
- [App Compatibility](https://developer.android.com/about/versions)

---

**Son Güncelleme**: 23 Ocak 2026  
**Test Ortamı**: Windows 11, Android Studio, API 34  
**Test Cihazları**: Pixel 6 Emulator, Fiziksel Android cihazlar
