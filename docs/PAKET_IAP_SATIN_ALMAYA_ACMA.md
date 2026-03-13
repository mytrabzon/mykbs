# Paketi IAP Satın Almaya Açma (iOS + Android)

Uygulama bundle’ı: **`com.litxtech.kbsprime`**. IAP’ın çalışması için aşağıdaki adımları tamamlayın.

---

## 1. Apple Developer Portal – In-App Purchase açma

1. [developer.apple.com](https://developer.apple.com) → **Account** → **Certificates, Identifiers & Profiles**.
2. Sol menüden **Identifiers** → uygulamanızın **App ID**’sini bulun (`com.litxtech.kbsprime`).
3. App ID’ye tıklayın → **Edit** (veya **Configure**).
4. **Capabilities** listesinde **In-App Purchase**’ı işaretleyin (✓).
5. **Save** → onaylayın.

Bundan sonra bu App ID ile alınan tüm build’ler IAP kullanabilir. EAS Build aynı Bundle ID ile build aldığı için ekstra kod değişikliği gerekmez.

---

## 2. App Store Connect – In-App Purchase ürünleri

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **KBS Prime** (veya uygulamanız).
2. Sol menüden **Features** → **In-App Purchases**.
3. **+** veya **Create** ile yeni ürün ekleyin.
4. **Type:** **Consumable** seçin (kredi paketi tekrar satın alınabilsin diye).

Her paket için aşağıdaki **Product ID**’leri kullanın (uygulama ve backend ile uyumlu):

| Paket   | Product ID (Apple)                              |
|--------|--------------------------------------------------|
| Starter  | `com.litxtech.kbsprime.paket.starter.credits`  |
| Pro      | `com.litxtech.kbsprime.paket.pro.credits`      |
| Business | `com.litxtech.kbsprime.paket.business.credits` |

5. Her ürün için:
   - **Reference Name** (iç kullanım): örn. "KBS Prime Starter"
   - **Pricing** (Turkey): 399,99 / 1.299,99 / 2.999,99 TRY
   - **App Store Localization** → Turkish: **Display Name** ve **Description** doldurun
   - **Review Information** gerekirse ekleyin

Detaylı alan listesi için: **`docs/APP_STORE_CONNECT_IAP_DOLDURMA.md`**.

Ürünleri oluşturup **Missing Metadata** uyarılarını giderdikten sonra IAP, uygulama mağazada yayındayken (veya TestFlight ile) çalışır.

---

## 3. Test (iOS)

1. App Store Connect → **Users and Access** → **Sandbox** → **Testers** → Sandbox test hesabı ekleyin.
2. iPhone’da **Ayarlar → App Store → Sandbox Hesabı** ile bu hesapla giriş yapın.
3. Uygulamada (development build veya TestFlight) paket satın almayı deneyin.

**Apple ödeme ekranı çıkmıyorsa:** Gerçek cihaz kullanın (Simulator'da IAP çalışmaz). Expo Go kullanmayın; development build veya TestFlight gerekir. App Store Connect'te her paket için Consumable ürün oluşturulmuş ve Missing Metadata giderilmiş olmalı. Cihazda Ayarlar → App Store → Sandbox Hesabı ile test hesabı ile giriş yapın. Uygulama artık "ürün bulunamadı" veya "mağaza bağlantısı kurulamadı" gibi durumlarda daha açıklayıcı hata mesajı gösterecektir.

---

## 4. Android (Google Play)

IAP’ı Android’de de açmak için:

1. [play.google.com/console](https://play.google.com/console) → uygulama (package: `com.litxtech.kbsprime`).
2. **Monetize** → **Products** → **In-app products** → **Create product**.
3. Product ID’ler (uygulama ile uyumlu): `mykbs_paket_starter`, `mykbs_paket_pro`, `mykbs_paket_business`.
4. Fiyat ve açıklama girip **Active** yapın.

---

## 5. Backend: Apple Shared Secret (IAP doğrulama)

Satın alma sonrası backend makbuzu Apple'a göndererek doğrular. Bunun için **App-Specific Shared Secret** gerekir.

1. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **KBS Prime** (uygulamanız).
2. Sol menü **App Information** (veya uygulama sayfasında **App Information** linki).
3. **App-Specific Shared Secret** bölümünde **Generate** veya mevcut secret'ı kopyalayın.
4. Bu değeri backend ortam değişkeni olarak ekleyin:
   - **Yerel:** `backend/.env` içine `APPLE_IAP_SHARED_SECRET=...` yazın.
   - **Railway (production):** Proje → **Variables** → **New Variable** → `APPLE_IAP_SHARED_SECRET` = (kopyaladığınız secret). Kaydedip redeploy edin.

Eksikse `/api/siparis/iap-verify` şu hatayı döner: *"Apple IAP yapılandırması eksik (APPLE_IAP_SHARED_SECRET) veya makbuz boş."*

---

## 6. Proje tarafı (kontrol)

- **Bundle ID:** `mobile/app.config.js` → `ios.bundleIdentifier: "com.litxtech.kbsprime"` (zaten doğru).
- **Plugin:** `react-native-iap` + `paymentProvider: "both"` (zaten var).
- **Product ID’ler:** `mobile/src/constants/iapProducts.js` ve `backend/src/config/iapProducts.js` yukarıdaki ID’lerle uyumlu.

Ek kod değişikliği gerekmez; backend'de `APPLE_IAP_SHARED_SECRET` tanımlı olması ve Apple/Google tarafındaki ayarlar yeterli.

---

## Özet

| Nerede | Ne yapılacak |
|--------|----------------|
| Apple Developer | App ID `com.litxtech.kbsprime` → Capabilities → **In-App Purchase** ✓ |
| App Store Connect | In-App Purchases → Consumable ürünler oluştur (starter, pro, business) |
| Backend (Railway) | `APPLE_IAP_SHARED_SECRET` ortam değişkeni = App Store Connect’teki App-Specific Shared Secret |
| Test | Sandbox hesabı ile uygulamada satın alma dene |

Bu adımlardan sonra paketleriniz IAP satın almaya açılmış olur.
