# KBS Prime – Evrensel MRZ Sistemi

Sıfırdan yazılmış, **hiçbir dış MRZ SDK’sı** (Regula, SmartEngines vb.) kullanmayan evrensel MRZ okuma sistemi.

## Bileşenler

| Bileşen | Konum | Açıklama |
|--------|--------|----------|
| **UniversalMrzParser** | `backend/src/lib/mrz/universalMrzParser.js` + `mobile/src/lib/mrz/universalMrzParser.js` | TD1 / TD2 / TD3 format algılama ve parse |
| **UniversalPreprocessor** | `backend/src/lib/vision/universalPreprocess.js` | Görüntü ön işleme (Jimp): MRZ bölgesi, kontrast, keskinleştirme, eşik |
| **UniversalOcr** | `backend/src/lib/vision/universalOcr.js` | Tesseract ile MRZ OCR (whitelist, PSM 6, çoklu deneme) |
| **API** | `backend/src/routes/universalMrz.js` | `POST /api/universal-mrz/read`, `POST /api/universal-mrz/read-multiple` |
| **Mobil** | `mobile/src/features/kyc/UniversalMrzScreen.js` + `hooks/useUniversalMrzReader.js` | Galeri/kamera → API → MrzResult |

## MRZ formatları

- **TD1**: 3 satır × 30 karakter (T.C. kimlik, bazı ülke kimlikleri)
- **TD2**: 2 satır × 36 karakter (vize, ehliyet, ikamet)
- **TD3**: 2 satır × 44 karakter (pasaport)

## API kullanımı

### POST /api/universal-mrz/read

- **Body**: `{ imageBase64: string, options?: { isPhotocopy?: boolean, isScreen?: boolean } }`
- **Auth**: Tesis veya Supabase token gerekli
- **Yanıt**: `{ success, confidence, mrz, parsed, format }`

### POST /api/universal-mrz/read-multiple

- **Body**: `{ imageBase64: string }`
- Görüntüyü 3 dilime bölüp her dilimde MRZ arar (yan yana belgeler).

## Mobil

- Drawer: **Evrensel MRZ (Galeri/Kamera)** veya Stack: `navigation.navigate('UniversalMrz')`
- Galeriden seç veya kamera ile çek → backend’e base64 gönderilir → sonuç **MrzResult** ekranına gider.

## Test senaryoları

1. Pasaport (TD3) – 2×44
2. T.C. Kimlik (TD1) – 3×30
3. Ehliyet / vize (TD2) – 2×36
4. Fotokopi (düşük kontrast) – `options.isPhotocopy: true`
5. Ekran görüntüsü – `options.isScreen: true`
6. İki pasaport yan yana – `/read-multiple`
7. Yıpranmış / eğik belge – çoklu ön işleme denemesi

Hedef: Tüm dünya pasaportları, T.C. kimlikleri, ehliyetler, kağıt baskılar ve ekran görüntüleri tek sistemle okunabilsin.
