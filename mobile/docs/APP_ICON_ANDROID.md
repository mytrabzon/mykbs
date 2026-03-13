# Android'de Uygulama İkonu Görünmüyorsa

## Sorun

Expo ve Android **uygulama ikonu için kare (1024×1024 px) PNG** bekler. İkon dikdörtgen veya farklı ölçüdeyse Android’de ikon boş görünebilir veya hiç görünmeyebilir.

- **Şu anki `assets/icon.png`**: 1376×768 (dikdörtgen) → Android’de doğru işlenmiyor.
- **Gerekli**: 1024×1024 px, PNG, mümkünse şeffaf veya tek renk arka plan.

## Çözüm 1: Script ile otomatik düzeltme

Proje kökünde (mobile klasöründe):

```bash
npm run fix:icon
```

Bu komut mevcut `assets/icon.png` dosyasını 1024×1024 kareye dönüştürür (logo ortada, kenarlar beyaz/şeffaf). Sonrasında:

```bash
npx expo prebuild --clean
```

çalıştırıp yeniden build alın.

## Çözüm 2: Elle 1024×1024 ikon hazırlama

1. Logo/ikonu **1024×1024 px** kare bir PNG olarak dışa aktarın (Figma, Photoshop vb.).
2. Android Adaptive Icon için: Önemli kısım **ortadaki %66 alanda** kalsın (kenarlar maskede kesilebilir).
3. Dosyayı `mobile/assets/icon.png` olarak kaydedin (öncekini yedekleyip değiştirin).
4. `npx expo prebuild --clean` çalıştırıp yeniden build alın.

## Özet

| Özellik        | Beklenen   | Sizin dosya |
|----------------|------------|-------------|
| Genişlik       | 1024 px    | 1376 px     |
| Yükseklik      | 1024 px    | 768 px      |
| Oran           | 1:1 (kare) | ~1.79:1     |

İkonu 1024×1024 yaptıktan ve `prebuild --clean` + yeni build aldıktan sonra Android’de ikon düzgün görünür.
