# iOS crash (RCTThirdPartyComponentsProvider) – tek seferlik çözüm

Uygulama açılır açılmaz kapanıyorsa ve crash log’da şu hata varsa:

```
NSInvalidArgumentException: attempt to insert nil object from objects[0]
RCTThirdPartyComponentsProvider thirdPartyFabricComponents
```

**Sebep:** iOS build’i React Native **New Architecture (Fabric)** ile alınmış; bir Fabric bileşeni `nil` dönüyor ve uygulama çöküyor.

**Yapılan config değişiklikleri:**
- `app.config.js`: `expo.newArchEnabled: false` (kök düzey) + `expo-build-properties` içinde `ios: { newArchEnabled: false }`
- Böylece **yeni** alınan tüm iOS build’lerde New Arch kapalı olacak.

**Senin yapman gereken (bir kere):**

Eski build cache’i kullanılmaması için iOS development build’i **cache temizleyerek** al:

```bash
cd mobile
npx eas build --platform ios --profile development --clear-cache
```

Build bitince çıkan IPA’yı yükle. Bu build’den sonra aynı crash’i tekrar görmemen gerekir; bir daha `--clear-cache` zorunlu değil.
