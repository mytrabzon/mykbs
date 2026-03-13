/**
 * assets/icon.png dosyasını 1024x1024 kare yapar.
 * Android/Expo uygulama ikonu için gerekli (dikdörtgen ikon Android'de görünmeyebilir).
 *
 * Kullanım: npm run fix:icon
 * Sonrasında: npx expo prebuild --clean && yeniden build alın.
 */

const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');
const ICON_PATH = path.join(ASSETS, 'icon.png');
const ICON_BACKUP = path.join(ASSETS, 'icon.png.bak');
const SIZE = 1024;

function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('sharp yüklü değil. Önce çalıştırın: npm install --save-dev sharp');
    process.exit(1);
  }

  if (!fs.existsSync(ICON_PATH)) {
    console.error('Dosya bulunamadı:', ICON_PATH);
    process.exit(1);
  }

  const run = async () => {
    const meta = await sharp(ICON_PATH).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    console.log('Mevcut icon boyutu:', w, 'x', h);

    if (w === SIZE && h === SIZE) {
      console.log('İkon zaten 1024x1024. Çıkılıyor.');
      return;
    }

    // Yedek al
    fs.copyFileSync(ICON_PATH, ICON_BACKUP);
    console.log('Yedek:', ICON_BACKUP);

    // 1024x1024 beyaz arka plan, logo ortada (contain)
    const buf = await sharp(ICON_PATH)
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();

    fs.writeFileSync(ICON_PATH, buf);
    console.log('icon.png 1024x1024 olarak güncellendi.');
    console.log('Sonraki adım: npx expo prebuild --clean');
  };

  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

main();
