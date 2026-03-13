/**
 * Python MRZ servisi (OmniMRZ) istemcisi.
 * PYTHON_MRZ_URL yoksa veya servis ulaşılamazsa fallback kullanılır.
 */
const axios = require('axios');

const baseURL = process.env.PYTHON_MRZ_URL || 'http://localhost:5001';
const timeout = Number(process.env.PYTHON_MRZ_TIMEOUT) || 15000;

async function processImage(imageBase64) {
  try {
    const response = await axios.post(
      `${baseURL}/mrz/process`,
      { imageBase64 },
      { timeout, headers: { 'Content-Type': 'application/json' } }
    );
    return { success: true, data: response.data };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.warn('[pythonMrz] Servis ulaşılamıyor, Tesseract kullanılacak:', baseURL);
      return { success: false, error: 'MRZ servisi çalışmıyor', fallback: true };
    }
    if (err.response) {
      return {
        success: false,
        error: err.response.data?.error || 'MRZ işleme hatası',
        fallback: true,
      };
    }
    console.warn('[pythonMrz] İstek hatası:', err.message);
    return { success: false, error: err.message, fallback: true };
  }
}

async function healthCheck() {
  try {
    const res = await axios.get(`${baseURL}/health`, { timeout: 2000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

module.exports = { processImage, healthCheck };
