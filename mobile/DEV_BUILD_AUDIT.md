# Dev Build Köklü Kontrol Raporu

**Tarih:** 2026-02-26  
**Amaç:** EAS development build öncesi engel ve risklerin taranması.

---

## ✅ Sorunsuz / Uyumlu

| Kontrol | Durum | Not |
|--------|--------|-----|
| **eas.json** | OK | `development` profili: `developmentClient: true`, `gradleCommand: ":app:assembleDebug"`, `buildType: apk` |
| **app.config.js** | OK | `name`, `slug`, `version`, `android.package`, `extra.eas.projectId` (5fccdd12...) mevcut |
| **Android SDK** | OK | compileSdk/targetSdk 35, buildTools 35.0.0, minSdk 23 |
| **Kotlin / KSP** | OK | Kotlin 2.0.21, KSP 2.0.21-1.0.28, incremental kapalı (stabilite) |
| **NDK** | OK | 27.0.12077973 (Expo modülleriyle uyumlu) |
| **gradle.properties** | OK | Memory, KSP, ext değişkenleri tanımlı |
| **android/build.gradle** | OK | ext { compileSdkVersion, ndkVersion, ... } + KSP plugin |
| **android/app/build.gradle** | OK | rootProject.ext kullanıyor, namespace com.mykbs.app |
| **android/settings.gradle** | OK | expo-autolinking-settings, useExpoModules(), include :app |
| **AndroidManifest.xml** | OK | Gerekli izinler, MainActivity, expo scheme (exp+mykbs) |
| **package.json** | OK | expo ~54, expo-dev-client ~6.0.20, expo-updates ~29.0.16, react-native-webview mevcut |
| **Gradle wrapper** | OK | gradlew / gradlew.bat, Gradle 8.14.3 |
| **.easignore** | OK | Sadece build/cache/IDE exclude; kaynak kod dahil |
| **Plugins** | OK | expo-camera, react-native-nfc-manager, expo-build-properties |
| **Supabase / EAS env** | OK | extra içinde EXPO_PUBLIC_*; EAS development env’de SUPABASE_* yüklü olabilir |

---

## ⚠️ Dikkat / Olası Engel

### 1. ~~EAS Free plan kotası~~ (Pro paket – kota engel değil)

### 2. Git repository
- **Durum:** EAS, VCS (git) ile proje kökünü ve değişiklikleri kullanır; repo yoksa uyarı verir, bazen fingerprint/önbellek davranışı farklı olur.
- **Yapılacak:** Proje kökünde `git status` çalışıyor mu kontrol et. Yoksa `git init` + en az bir commit yap.

### 3. EAS girişi
- **Yapılacak:** `eas whoami` ile hesaba giriş yapıldığından emin ol. Gerekirse `eas login`.

### 4. Android credentials (keystore)
- **Durum:** Daha önce “Using remote Android credentials (Expo server)” görüldüğü için keystore büyük ihtimalle EAS’ta tanımlı.
- **Yapılacak:** İlk kez build alıyorsan veya credential değiştiyse [Expo Credentials](https://expo.dev/accounts/luvolive/projects/mykbs/credentials) sayfasından Android’i kontrol et.

---

## 🔧 Yapılan / Önerilen Tek Düzeltme

- **expo-build-properties:** `app.config.js` içinde zaten `compileSdkVersion: 35`, `kotlinVersion: "2.0.21"` vb. tanımlı; `android/gradle.properties` ile uyumlu. Ek değişiklik gerekmedi.

---

## 📋 Build Öncesi Kısa Checklist

1. [ ] `eas whoami` ile giriş yapıldı.
2. [ ] Proje kökünde git repo var ve en az bir commit atıldı.
3. [ ] `cd mobile` → `eas build --platform android --profile development` çalıştırıldı.
4. [ ] Build başlamazsa veya “build command failed” alırsan: [build log](https://expo.dev/accounts/luvolive/projects/mykbs/builds) içinde “Run gradlew” aşamasına bak; credential’ları kontrol et.

---

## Sonuç

- **Proje tarafı:** Dev build’e engel olacak yapılandırma veya eksik dosya yok; Android/Gradle/Expo ayarları tutarlı.
- **Muhtemel engeller:** Credential veya Gradle/KSP hatası. Pro paket kullanıldığı için kota engel değil. Build fail olursa EAS build log’daki “Run gradlew” çıktısına bakılmalı.
