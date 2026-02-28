/**
 * Image preprocessing for scan: grayscale, normalize, contrast.
 * Uses Jimp (no OpenCV). For deskew/crop we could add later.
 */

const path = require('path');
const fs = require('fs');

/**
 * Preprocess image for MRZ/OCR: grayscale, normalize, contrast.
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} Same filePath after write
 */
async function preprocessForOcr(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    const image = await Jimp.read(filePath);
    await image
      .greyscale()
      .normalize()
      .contrast(0.2)
      .write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Fotokopi / kağıt MRZ için güçlü ön işleme: yüksek kontrast, netlik (resize up then back) – basılı MRZ daha iyi okunur.
 * @param {string} filePath - Path to image file
 * @returns {Promise<string>} Same filePath after write
 */
async function preprocessForPhotocopyMrz(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return filePath;
  try {
    const Jimp = (await import('jimp')).default;
    let image = await Jimp.read(filePath);
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    await image
      .greyscale()
      .normalize()
      .contrast(0.45)
      .write(filePath);
    return filePath;
  } catch (e) {
    return filePath;
  }
}

/**
 * Load image from base64, preprocess, and optionally save to temp file.
 * @param {string} imageBase64 - JPEG/PNG base64 string
 * @param {string} [tempDir] - Directory for temp file (optional; if not set, returns buffer in memory is not implemented - we write to temp)
 * @returns {Promise<{ filePath: string }>} Path to preprocessed image
 */
async function preprocessFromBase64(imageBase64, tempDir) {
  const buf = Buffer.from(imageBase64, 'base64');
  if (buf.length === 0) throw new Error('Invalid image: empty buffer');
  const dir = tempDir || require('os').tmpdir();
  const filename = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.jpg`;
  const filePath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, buf);
  await preprocessForOcr(filePath);
  return { filePath };
}

module.exports = {
  preprocessForOcr,
  preprocessFromBase64,
  preprocessForPhotocopyMrz,
};
