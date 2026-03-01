# Android push bildirimleri (FCM)

Android’de `getExpoPushTokenAsync()` **Firebase Cloud Messaging (FCM)** kullanır. FCM yapılandırılmamışsa şu hata loglanır ve push kaydı atlanır (uygulama çalışmaya devam eder):

- `Default FirebaseApp is not initialized...`

## Push’u açmak için

1. **Firebase projesi**
   - [Firebase Console](https://console.firebase.google.com) → Proje oluştur veya mevcut projeyi seç.
   - Android uygulaması ekle, paket adı: **`com.litxtech.mykbs`** (app.config.js ile aynı olmalı).

2. **google-services.json**
   - Firebase’den **google-services.json** indir.
   - Dosyayı `mobile/` köküne koy: `mobile/google-services.json`.

3. **app.config.js**
   - `expo.android` içine ekle:
   ```js
   googleServicesFile: "./google-services.json",
   ```

4. **EAS Build ile FCM v1 (önerilen)**
   - [Expo: FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) adımını uygula.
   - `eas credentials` ile Android için FCM v1 service account key yükle.

5. **Yeniden build**
   - `npx eas build --platform android --profile development` (veya kullandığın profile) ile yeni bir Android build al.

Bunları yapmadan da uygulama çalışır; sadece Android’de push token alınamaz ve bildirimler gelmez. iOS için ayrıca APNs ayarı gerekir (EAS genelde halleder).
