/**
 * MRZ pipeline debug: ön işlenmiş görüntüleri diske yazar (SAVE_DEBUG_IMAGES=true).
 */

const path = require('path');
const fs = require('fs');

/**
 * Ön işlenmiş Jimp görüntüsünü debug-images klasörüne kaydeder.
 * @param {object} image - Jimp örneği (writeAsync destekler)
 * @param {string} name - Dosya adı eki (örn. 'normal', 'high_contrast')
 */
async function saveDebugImage(image, name) {
  if (process.env.SAVE_DEBUG_IMAGES !== 'true' && process.env.SAVE_DEBUG_IMAGES !== '1') return;
  if (!image || typeof image.writeAsync !== 'function') return;
  try {
    const debugDir = path.join(__dirname, '../../../debug-images');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const filename = `${Date.now()}_${(name || 'debug').replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
    const filepath = path.join(debugDir, filename);
    await image.writeAsync(filepath);
    console.log('[MRZ debug] Görüntü kaydedildi:', filename);
  } catch (e) {
    console.warn('[MRZ debug] Kayıt hatası:', e.message);
  }
}

/**
 * Buffer'ı debug klasörüne dosya olarak yazar.
 * @param {Buffer} buf
 * @param {string} name
 */
async function saveDebugBuffer(buf, name) {
  if (process.env.SAVE_DEBUG_IMAGES !== 'true' && process.env.SAVE_DEBUG_IMAGES !== '1') return;
  if (!buf || !Buffer.isBuffer(buf)) return;
  try {
    const debugDir = path.join(__dirname, '../../../debug-images');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const filename = `${Date.now()}_${(name || 'buffer').replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`;
    const filepath = path.join(debugDir, filename);
    fs.writeFileSync(filepath, buf);
    console.log('[MRZ debug] Buffer kaydedildi:', filename);
  } catch (e) {
    console.warn('[MRZ debug] Kayıt hatası:', e.message);
  }
}

module.exports = {
  saveDebugImage,
  saveDebugBuffer,
};
