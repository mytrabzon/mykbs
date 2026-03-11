# Apple & Google Play İçi Uygulama Satın Alma (IAP) – Ayarlar ve Bundle ID’ler

Bu dokümanda KBS Prime uygulaması için **Apple App Store** ve **Google Play** üzerinden paket satışı (IAP) için gereken **bundle identifier / package name** ve mağaza ayarları özetlenmiştir.

---

## 0. Mevcut Akış (Canlıda Sorun Çıkarmaz)

**Şu an uygulamada gerçek mağaza ödemesi (Apple/Google IAP) kullanılmıyor.**

- **"Satın al" butonu** → Backend `POST /api/siparis` çağrılır → sipariş kaydı oluşturulur (`durum: pending`).
- Kullanıcıya "Sipariş no: … Ödeme bilgisi e-posta/SMS ile iletilecektir" mesajı gösterilir.
- Admin panelden ödeme alındığında sipariş onaylanır ve paket tesisine atanır.

Bu akış **test ve canlıda aynı**; gerçek kart/App Store ödemesi yok. **Canlıda da sorun çıkarmaz**: sipariş oluşur, siz ödemeyi dışarıda alıp panelden onaylarsınız.

İleride **App Store / Google Play üzerinden anında ödeme** (IAP) kullanmak isterseniz: Product ID’ler (`iapProducts.js`) ve bu dokümandaki mağaza ayarları hazır; uygulama tarafında `PaywallModal` içinde `react-native-iap` ile `requestPurchase` + makbuz doğrulama + backend’e bildirim akışı eklenmeli.

---

## 1. Bundle / Package Değerleri (Tek Kaynak)

Projede **tek bir uygulama kimliği** kullanılıyor; iOS ve Android aynı değerle tanımlanır:

| Platform | Ayar adı | Değer |
|----------|----------|--------|
| **iOS** | Bundle Identifier | `com.litxtech.mykbs` |
| **Android** | Application ID / package | `com.litxtech.mykbs` |

Bu değerler şu dosyalarda tanımlıdır:

- **Expo / genel:** `mobile/app.config.js` → `ios.bundleIdentifier`, `android.package`
- **Android native:** `mobile/android/app/build.gradle` → `applicationId 'com.litxtech.mykbs'`, `namespace 'com.litxtech.mykbs'`
- **Android Java/Kotlin:** `mobile/android/app/src/main/java/com/litxtech/mykbs/` paket yolu

Değiştirmek isterseniz **hem** `app.config.js` **hem** `android/app/build.gradle` ve klasör yapısını güncellemeniz gerekir. Mümkünse bundle/package’ı **bir kez seçip sabit bırakın**.

---

## 2. Apple App Store (iOS) Ayarları

### 2.1 Gerekli hesaplar ve uygulama

- **Apple Developer Program** üyeliği (yıllık ücret).
- **App Store Connect** ve **Xcode / EAS Build** ile aynı **Bundle ID** kullanılmalı: `com.litxtech.mykbs`.

### 2.2 App Store Connect adımları

1. **App Store Connect** → [apps.apple.com](https://appstoreconnect.apple.com) → **My Apps**.
2. Uygulama oluşturun veya mevcut uygulayı seçin.
3. **Bundle ID:** `com.litxtech.mykbs` olan bir **App ID** kullanın (Xcode / Developer Portal’da da aynı olmalı).
4. **In-App Purchase:**
   - Sol menüden **Features** → **In-App Purchases**.
   - **Create** → **Consumable** veya **Non-Consumable** (paketler tek seferlik kredi olduğu için genelde **Consumable**).
   - Her paket için bir **Product ID** oluşturun (aşağıdaki tabloyu kullanabilirsiniz).

### 2.3 Önerilen Apple Product ID’ler

Uygulama içinde kullandığınız paket `id`’leri ile mağaza Product ID’lerini eşleyin:

| Paket (uygulama) | Apple Product ID (örnek) |
|------------------|---------------------------|
| starter | `com.litxtech.mykbs.paket.starter` |
| pro | `com.litxtech.mykbs.paket.pro` |
| business | `com.litxtech.mykbs.paket.business` |
| enterprise | `com.litxtech.mykbs.paket.enterprise` |

- **Type:** Consumable doğru (kredi paketi tekrar satın alınabilir). **Missing Metadata** için her ürünü açıp **App Store Localization** bölümünde **Display Name** ve **Description**, ayrıca **Pricing** ile fiyat atayın. Önerilen metinler:

| Product ID | Display Name | Description |
|------------|--------------|-------------|
| com.litxtech.mykbs.paket.starter | Starter – 250 Bildirim | 250 oda bildirimi kredisi. Konaklama tesisinizde misafir giriş/çıkış bildirimleri için kullanılır. |
| com.litxtech.mykbs.paket.pro | Pro – 1000 Bildirim | 1000 oda bildirimi kredisi. Konaklama tesisinizde misafir giriş/çıkış bildirimleri için kullanılır. |
| com.litxtech.mykbs.paket.business | Business – 3000 Bildirim | 3000 oda bildirimi kredisi. Konaklama tesisinizde misafir giriş/çıkış bildirimleri için kullanılır. |
| com.litxtech.mykbs.paket.enterprise | Enterprise – 10000 Bildirim | 10000 oda bildirimi kredisi. Konaklama tesisinizde misafir giriş/çıkış bildirimleri için kullanılır. |

Fiyat referansı: Starter 399,99 ₺, Pro 1.299,99 ₺, Business 2.999,99 ₺, Enterprise 9.999 ₺. Her ürün için **Reference Name**, **Price (Tier)** ve **Localization** tamamlandığında "Missing Metadata" kaybolur.
- **In-App Purchase**, Apple’da ayrı bir “capability” değil; **App ID** (wildcard olmayan) ile uygulama yayınlandığında kullanılabilir. EAS Build ile `com.litxtech.mykbs` ile build alıyorsanız ekstra entitlement dosyası zorunlu değildir.

### 2.4 EAS Build (iOS)

- **eas.json** içinde `production` (veya kullandığınız profil) ile `eas build --platform ios --profile production` çalıştırın.
- **Credentials:** EAS, Apple Developer hesabınıza bağlı **Distribution Certificate** ve **Provisioning Profile** kullanır; Bundle ID `com.litxtech.mykbs` ile eşleşmeli.
- İlk kez: `eas credentials` ile Apple hesabınızı bağlayıp sertifika/provisioning’i EAS’a bırakabilirsiniz.

### 2.5 Test

- **Sandbox:** App Store Connect’te **Users and Access** → **Sandbox** test hesabı oluşturun.
- Cihazda **Settings → App Store → Sandbox Account** ile bu hesapla giriş yapıp uygulamada satın alma deneyin.

---

## 3. Google Play (Android) Ayarları

### 3.1 Gerekli hesaplar

- **Google Play Console** geliştirici hesabı (bir kerelik kayıt ücreti).
- Uygulama **Application ID**’si: `com.litxtech.mykbs` (build.gradle ile aynı olmalı).

### 3.2 Google Play Console adımları

1. **Play Console** → Uygulama seçin (veya yeni uygulama ekleyin).
2. **Monetize** → **Products** → **In-app products** (veya **Subscriptions** abonelik kullanacaksanız).
3. **Create product** ile her paket için bir **Product ID** tanımlayın.

### 3.3 Önerilen Google Product ID’ler

| Paket (uygulama) | Google Product ID (örnek) |
|------------------|----------------------------|
| starter | `mykbs_paket_starter` |
| pro | `mykbs_paket_pro` |
| business | `mykbs_paket_business` |
| enterprise | `mykbs_paket_enterprise` |

- **Product type:** **Managed product** (tek seferlik) veya ihtiyaca göre **Subscription**.
- Her ürün için **Name**, **Description** ve **Price** girin; **Active** yapın.

### 3.4 Imza (signing)

- **EAS Build** ile release build alırken **EAS Submit** veya Play Console’a yüklerken **App signing** için:
  - Ya **Play App Signing** kullanın (önerilir) ve EAS’ın oluşturduğu veya sizin yüklediğiniz keystore ile imzalayın.
  - `eas.json` içinde `submit` profili ile `eas submit` kullanıyorsanız, build çıktısı ve credentials doğru olmalı.

### 3.5 Test

- **License testing:** Play Console → **Setup** → **License testing** → test e‑posta ekleyin.
- **Internal testing** veya **Closed testing** track’e yükleyip aynı hesapla cihazda satın alma testi yapın.

---

## 4. Proje İçi Yapılandırma Özeti

### 4.1 app.config.js (Expo)

- `ios.bundleIdentifier: "com.litxtech.mykbs"`
- `android.package: "com.litxtech.mykbs"`
- IAP için: `react-native-iap` config plugin’i eklendi (`paymentProvider: "both"`).

### 4.2 eas.json

- **Build:** `development`, `preview`, `production` profilleri mevcut. Bundle/package değerleri `app.config.js`’ten alınır.
- **Submit:** `submit.production` ile App Store / Play’e otomatik gönderim:
  - **iOS:** `appleId` (Apple ID e‑posta), `ascAppId` (App Store Connect’te uygulama sayfasındaki sayısal App ID). Bu değerleri `eas.json` içinde kendi bilgilerinizle değiştirin.
  - **Android:** `serviceAccountKeyPath` → Play Console’dan indirdiğiniz JSON anahtar dosyasının yolu (örn. `./play-service-account.json`).
- Gönderim: `eas submit --platform ios --profile production` veya `--platform android`.

### 4.3 IAP kütüphanesi

- **react-native-iap** kullanılıyor (Expo development build gerekir; Expo Go’da IAP çalışmaz).
- Kurulum: `mobile` klasöründe `npm install react-native-iap` (veya `yarn add react-native-iap`). Sonrasında `npx expo prebuild --clean` veya `eas build` ile yeniden build alın.
- Mağaza Product ID’leri uygulama tarafında **`mobile/src/constants/iapProducts.js`** içinde tutulur; `starter` / `pro` / `business` / `enterprise` ile eşlenir.

---

## 5. Kontrol Listesi

- [ ] Apple: App ID `com.litxtech.mykbs` oluşturuldu / kullanılıyor.
- [ ] Apple: App Store Connect’te In-App Purchase ürünleri (starter, pro, business, enterprise) tanımlı.
- [ ] Apple: Sandbox test hesabı ile satın alma testi yapıldı.
- [ ] Google: Play Console’da uygulama `com.litxtech.mykbs` ile tanımlı.
- [ ] Google: In-app products (veya subscriptions) oluşturuldu ve Active.
- [ ] Google: License testing veya test track ile satın alma testi yapıldı.
- [ ] Mobil projede `app.config.js` ve `android/app/build.gradle` bundle/package ile uyumlu.
- [ ] EAS Build ile iOS ve Android production build alındı.
- [ ] IAP akışı (ürün listesi, satın al, doğrulama) uygulama içinde test edildi.

Bu adımlar ve bundle/package değerleri (`com.litxtech.mykbs`) ile Apple ve Google Play IAP ayarlarınızı tek kaynaktan yönetebilirsiniz.
