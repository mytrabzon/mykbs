# 502 "Application failed to respond" – OCR ve Railway

## Belirti

- Galeriden kimlik seçildiğinde `POST /api/ocr/document-base64` **502** döner.
- Mesaj: `Application failed to respond` (Railway proxy, uygulama yanıt vermeden bağlantıyı keser).

## Olası nedenler

1. **İstek süresi uzun** – OCR (Tesseract + runMrzPipeline) 30–60 saniyeyi geçerse Railway proxy veya Node istek timeout’u yanıtı keser.
2. **Bellek (OOM)** – Büyük base64 + Jimp + Tesseract bellek tüketir; Railway konteyneri öldürebilir.
3. **Cold start** – İlk istekte konteyner henüz hazır değilse proxy 502 verebilir.

## Backend’de yapılanlar

- **server.js:** `server.requestTimeout` ve `server.headersTimeout` artırıldı (varsayılan 2 dk; `REQUEST_TIMEOUT_MS` ile özelleştirilebilir).
- **ocr.js `/document-base64`:** Bu route için `res.setTimeout(120000)` (2 dakika) eklendi.

Bunlar Node tarafında bağlantının erken kapanmasını azaltır; **Railway’ın kendi proxy timeout’u** ayrı bir limit olabilir (genelde platform 15 dakikaya kadar izin verir; bölge/plana göre değişir).

## Railway tarafında kontrol

1. **Dashboard → Proje → Backend servisi → Settings / Variables**
   - `PORT` doğru mu, uygulama `0.0.0.0:PORT` dinliyor mu?
   - Gerekirse **Request timeout** veya **Proxy** ayarlarını kontrol et (varsa).

2. **Logs**
   - 502 anında backend log’unda hata veya “out of memory” var mı?
   - `[document-base64] istek (kimlik/pasaport okuma)` görünüp sonrasında cevap log’u yoksa işlem timeout veya çökme ile bitmiş olabilir.

3. **Metrics**
   - Memory kullanımı yüksek mi? OCR sırasında spike oluyorsa görsel boyutunu küçültmek işe yarar.

## İsteğe bağlı: timeout süresini artırma

Backend’de 2 dakikadan daha uzun süre vermek istersen:

```bash
# Railway env (veya .env)
REQUEST_TIMEOUT_MS=180000
```

Mobil tarafta zaten 60 saniye timeout var (`MrzScanScreen`); backend’i 2 dakika yaptık. OCR genelde 60 saniye içinde biter; bitmezse önce görsel boyutunu küçültmek veya backend log’larında nerede takıldığını incelemek mantıklı.

## Özet

- 502 büyük ihtimalle **yanıt süresinin uzunluğu** veya **bellek** kaynaklı.
- Backend’de OCR route ve genel server timeout’ları 2 dakikaya çıkarıldı.
- Sorun sürerse: Railway log + metrics’e bakın; gerekirse galeriden gönderilen görseli mobilde küçültün (max genişlik/yükseklik veya JPEG kalitesi).
