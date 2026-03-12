# Android: Build ve Google Play Store

## 1. Production build al

**Terminalde (mobile klasöründen):**

```powershell
cd c:\MYKBS\mobile
npx eas build --platform android --profile production
```

veya repo kökünden:

```powershell
cd c:\MYKBS
npm run build:android
```

- EAS ilk seferde Android için keystore/credentials oluşturur (veya sen yönetirsin).
- Build çıktısı: **AAB** (App Bundle) veya **APK**. Play Store için **AAB** tercih edilir.

**Not:** Şu an `eas.json` production Android için `buildType: "apk"` kullanıyor. Play Store’a yükleyeceksen AAB daha uygun. İstersen `"apk"` → `"aab"` yapılabilir.

---

## 2. Google Play Console hazırlığı

1. **https://play.google.com/console** → Google hesabınla giriş.
2. **Create app** ile uygulama oluştur (henüz yoksa).
3. **Package name:** `com.litxtech.kbsprime` (app.config.js ile aynı olmalı).
4. Store listing, gizlilik politikası, içerik derecelendirmesi vb. doldur (ilk yayın için zorunlu adımlar).

---

## 3. Submit için: Service Account (Play Store’a yükleme)

EAS’in build’i Play Store’a gönderebilmesi için bir **Google Play Service Account** ve JSON anahtar dosyası gerekir.

### 3.1 Service Account oluştur

1. **Google Cloud Console:** https://console.cloud.google.com
2. Proje seç (veya yeni proje) → **IAM & Admin** → **Service Accounts** → **Create Service Account**.
3. İsim ver (örn. `eas-play-submit`) → **Create and Continue** → **Done**.
4. Oluşan hesaba tıkla → **Keys** → **Add Key** → **Create new key** → **JSON** → indir. Bu dosyayı güvenli sakla.

### 3.2 Play Console’da yetki ver

1. **Google Play Console** → **Users and permissions** (veya **Setup** → **API access**).
2. **Invite new users** veya **Link** ile Service Account’u bağla (indirdiğin JSON’daki **client_email** ile).
3. Rol: **Release manager** veya **Admin** (en azından release yükleyebilsin).

### 3.3 Dosyayı projeye koy

İndirdiğin JSON dosyasını şu isimle **mobile** klasörüne kopyala:

```
c:\MYKBS\mobile\play-service-account.json
```

`eas.json` zaten bu yolu kullanıyor: `"serviceAccountKeyPath": "./play-service-account.json"`.

**Güvenlik:** Bu dosyayı **git’e ekleme**. `.gitignore`’da `play-service-account.json` olmalı.

---

## 4. Build’i Play Store’a gönder (submit)

Service Account ve `play-service-account.json` hazır olduktan sonra:

```powershell
cd c:\MYKBS\mobile
npx eas submit --platform android --profile production --latest
```

- `--latest` son Android production build’i kullanır.
- İlk seferde Play Console’da uygulamanın oluşturulmuş ve en az bir “release” track’i (Internal / Closed / Open testing veya Production) hazır olmalı.

---

## Özet

| Adım | Ne yapıyorsun |
|------|----------------|
| 1 | `npm run build:android` veya `eas build --platform android --profile production` |
| 2 | Play Console’da uygulama oluştur, package `com.litxtech.kbsprime`, store bilgilerini doldur |
| 3 | Google Cloud’da Service Account + JSON key oluştur, Play Console’da bu hesaba yetki ver |
| 4 | JSON’u `mobile/play-service-account.json` olarak koy |
| 5 | `eas submit --platform android --profile production --latest` |

---

## İsteğe bağlı: Play Store için AAB

Play Store için App Bundle (AAB) kullanmak istersen `mobile/eas.json` içinde production → android:

```json
"android": { "buildType": "aab" }
```

yap. Şu an `"apk"`; APK da yüklenebilir ama AAB önerilir.
