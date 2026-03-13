/**
 * Tesseract dil dosyalarını ön yükler (ilk OCR isteğinde gecikme olmaması için).
 * Çalıştırma: cd backend && npm run tess:install-langs
 */

const { OptimizedOcr, DEFAULT_LANGUAGES } = require('../src/lib/vision/optimizedOcr');

async function main() {
  console.log('Tesseract dil dosyaları yükleniyor:', DEFAULT_LANGUAGES.join(', '));
  const ocr = new OptimizedOcr();
  await ocr.initWorkers();
  console.log('Worker sayısı:', ocr.workers.length);
  // 1x1 PNG (minimal) ile bir kez recognize yaparak cache'i ısıt
  const minimalPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const result = await ocr.readWithAllLanguages(minimalPng);
  console.log('Örnek OCR (minimal görsel) tamamlandı:', result.lang, 'confidence:', result.confidence);
  await ocr.terminate();
  console.log('Tüm diller ön yüklendi.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
