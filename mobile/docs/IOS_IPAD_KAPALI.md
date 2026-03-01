# iOS: iPad'de Görünmemesi / İndirilmemesi

Uygulama yalnızca **iPhone** için tanımlı; iPad'de hiç görünmemesi için aşağıdakiler yapıldı ve yapılacaklar.

## Kod tarafı (yapıldı)

- **app.config.js**
  - `supportsTablet: false`
  - `infoPlist.UIDeviceFamily: [1]` → Sadece iPhone (1), iPad (2) yok.
- **App.js**
  - iPad'de açılsa bile (`Platform.isPad`) sadece “Bu uygulama iPad'de desteklenmemektedir” ekranı gösteriliyor.

Bu ayarlarla build alındığında uygulama **iPhone uygulaması** olarak paketlenir; App Store’da da “iPhone” olarak listelenir.

## App Store Connect (iPad’de hiç çıkmasın istiyorsan)

Uygulamanın iPad App Store’da hiç görünmemesi ve iPad’den indirilememesi için:

1. [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → **KBS Prime**.
2. **Pricing and Availability** (veya **App Information**) bölümüne gir.
3. **Device Availability** / **Cihaz kullanılabilirliği** kısmında **iPad**’i kapat (uncheck).
   - Bu seçenek bazen **App Information** altında “iOS Devices” veya “Supported Devices” olarak da geçer.
4. Değişikliği kaydedip bir sonraki sürümü (veya mevcut sürümü) yeniden submit et.

Böylece uygulama yalnızca iPhone’da listelenir; iPad kullanıcıları App Store’da bu uygulamayı görmez ve indiremez.

## Özet

| Ne | Durum |
|----|--------|
| Build / binary | Sadece iPhone (UIDeviceFamily: [1]) |
| iPad’de açılırsa | Engel ekranı |
| App Store’da iPad’de görünmesin | App Store Connect’te iPad’i kapat |
