# iOS Development Build (Tüm özellikler – NFC dahil)

Development build, native modülleri (NfcPassportReader, MRZ reader vb.) içerir. Expo Go ile çalışmayan özellikler bu build’de çalışır.

## Gereksinimler

- **Apple Developer hesabı** (ücretli)
- **EAS CLI:** `npm install -g eas-cli`
- **EAS girişi:** `eas login`

## Build’i başlatma (sizin terminalinizde)

Bu komut **Apple hesabı girişi** istediği için **mutlaka kendi açtığınız bir terminalde** (PowerShell, CMD veya Cursor Terminal) çalıştırın. Cursor’dan otomatik çalıştırıldığında “stdin is not readable” hatası alırsınız.

```bash
cd c:\MYKBS\mobile
npx eas build --platform ios --profile development
```

Veya:

```bash
cd c:\MYKBS\mobile
npm run build:ios:development
```

**İlk seferde EAS şunları sorar:**
- “Do you want to log in to your Apple account?” → **Yes** deyip Apple ID ve şifrenizi girin (veya App-specific password).
- Credential’ları kim yönetsin → **Let EAS manage** seçin.

Bundan sonra build EAS sunucularında başlar; tamamlanınca proje sayfasında link/QR çıkar.

## Build sonrası

- EAS sayfasında build tamamlanınca **QR kod** veya **indirme linki** çıkar.
- **Internal distribution** olduğu için yalnızca aynı Apple Developer ekibindeki cihazlara yüklenebilir (TestFlight yerine doğrudan IPA veya ad-hoc).
- iPhone’a yüklemek: EAS’ın verdiği linkten IPA’yı indirip (Mac’te) Apple Configurator / Xcode veya TestFlight ile yükleyebilirsiniz; veya EAS’ın önerdiği kurulum yöntemini kullanın.

## eas.json – development profili

- `developmentClient: true` → Expo Dev Client kullanılır.
- `distribution: "internal"` → Internal (ad-hoc) dağıtım.
- `ios.buildConfiguration: "Debug"` → Debug build (native modüller dahil).

Bu profille alınan build’de **react-native-nfc-passport-reader** ve diğer native kütüphaneler derlenir; NFC çip okuma (BAC + DG1/DG2) çalışır.
