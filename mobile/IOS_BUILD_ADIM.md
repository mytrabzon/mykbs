# iOS Development Build – Tek seferlik adım

Supabase projesi bağlandı (`supabase link` tamamlandı).

## iOS build için (ilk kez)

Terminalde **mobile** klasöründe şunu çalıştır:

```bash
cd mobile
eas init
```

Açılan soruda **"Would you like to automatically create an EAS project for @luvolive/mykbs?"** için **Y** (Yes) yazıp Enter’a bas.

Ardından iOS development build:

```bash
eas build --profile development --platform ios
```

Build EAS’ta biter; çıktıyı cihaza yükleyip veya simulator’da açabilirsin.

## Uygulamayı çalıştırıp Supabase’e bağlanmak

Development build yüklüyse veya `expo start --dev-client` ile çalışıyorsan:

```bash
cd mobile
npx expo start --dev-client
```

Uygulama açıldığında `.env` ve `app.config.js` içindeki `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` ile Supabase’e bağlanır.
