/**
 * iOS App Store'a gönderim: EAS_APPLE_ID ve EAS_ASC_APP_ID env ile.
 * Kullanım (PowerShell):
 *   $env:EAS_APPLE_ID="your@apple.id"; $env:EAS_ASC_APP_ID="1234567890"; node scripts/ios-submit-with-env.js
 * veya:
 *   npm run submit:ios:production
 * (Önce .env veya ortamda EAS_APPLE_ID ve EAS_ASC_APP_ID tanımlı olmalı)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const easPath = path.join(root, 'eas.json');
const backupPath = path.join(root, 'eas.json.submit-backup');

const appleId = process.env.EAS_APPLE_ID || process.env.APPLE_ID;
const ascAppId = process.env.EAS_ASC_APP_ID || process.env.ASC_APP_ID;

if (!appleId || !ascAppId) {
  console.error('Hata: EAS_APPLE_ID ve EAS_ASC_APP_ID (veya APPLE_ID, ASC_APP_ID) ortam değişkenleri gerekli.');
  console.error('Örnek (PowerShell):');
  console.error('  $env:EAS_APPLE_ID="your@email.com"; $env:EAS_ASC_APP_ID="1234567890"; npm run submit:ios:production');
  process.exit(1);
}

let originalJson;
try {
  originalJson = fs.readFileSync(easPath, 'utf8');
} catch (e) {
  console.error('eas.json okunamadı:', e.message);
  process.exit(1);
}

let eas;
try {
  eas = JSON.parse(originalJson);
} catch (e) {
  console.error('eas.json geçersiz JSON:', e.message);
  process.exit(1);
}

if (!eas.submit?.production?.ios) {
  console.error('eas.json içinde submit.production.ios bulunamadı.');
  process.exit(1);
}

// Yedek al, güncelle, submit çalıştır, yedekten geri yükle
eas.submit.production.ios.appleId = appleId;
eas.submit.production.ios.ascAppId = ascAppId;

try {
  fs.writeFileSync(backupPath, originalJson);
  fs.writeFileSync(easPath, JSON.stringify(eas, null, 2));
} catch (e) {
  console.error('eas.json yazılamadı:', e.message);
  process.exit(1);
}

function restore() {
  try {
    fs.writeFileSync(easPath, originalJson);
    fs.unlinkSync(backupPath);
  } catch (_) {}
}

const result = spawnSync('npx', ['eas', 'submit', '--platform', 'ios', '--profile', 'production', '--latest', '--non-interactive'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

restore();
process.exit(result.status || 0);
