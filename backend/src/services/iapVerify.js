/**
 * Apple ve Google IAP makbuz doğrulama.
 * Apple: legacy verifyReceipt (shared secret). Google: Play Developer API (service account).
 */

const axios = require('axios');

const APPLE_VERIFY_URL_PROD = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_VERIFY_URL_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';

/**
 * Apple App Store makbuz doğrula.
 * @param {string} receiptBase64 - Base64 encoded receipt data
 * @returns {{ valid: boolean, transactionId?: string, productId?: string, error?: string }}
 */
async function verifyAppleReceipt(receiptBase64) {
  const sharedSecret = process.env.APPLE_IAP_SHARED_SECRET;
  const hasSecret = Boolean(sharedSecret && String(sharedSecret).trim());
  const hasReceipt = Boolean(receiptBase64 && String(receiptBase64).trim());
  if (!hasSecret || !hasReceipt) {
    if (!hasSecret) console.warn('[iapVerify] APPLE_IAP_SHARED_SECRET ortam değişkeni eksik veya boş (Railway’da ekleyip redeploy edin).');
    if (!hasReceipt) console.warn('[iapVerify] Apple makbuz (receipt) boş veya sadece boşluk.');
    return { valid: false, error: 'Apple IAP yapılandırması eksik (APPLE_IAP_SHARED_SECRET) veya makbuz boş.' };
  }

  const body = {
    'receipt-data': receiptBase64,
    password: sharedSecret.trim(),
    'exclude-old-transactions': true,
  };

  let lastError;
  for (const url of [APPLE_VERIFY_URL_PROD, APPLE_VERIFY_URL_SANDBOX]) {
    try {
      const res = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });
      const data = res.data || {};
      const status = data.status;
      // 21007 = sandbox receipt sent to prod → try sandbox
      if (status === 21007) continue;
      if (status !== 0) {
        lastError = `Apple status ${status}`;
        continue;
      }
      const latest = data.latest_receipt_info || data.receipt?.in_app || [];
      const arr = Array.isArray(latest) ? latest : [latest];
      if (arr.length === 0) {
        return { valid: false, error: 'Makbuzda işlem bulunamadı.' };
      }
      const tx = arr[arr.length - 1];
      const transactionId = tx.transaction_id || tx.original_transaction_id;
      const productId = tx.product_id;
      if (!transactionId || !productId) {
        return { valid: false, error: 'Geçersiz makbuz yanıtı.' };
      }
      return { valid: true, transactionId: String(transactionId), productId };
    } catch (err) {
      lastError = err.response?.data?.toString() || err.message;
    }
  }
  return { valid: false, error: lastError || 'Apple doğrulama başarısız.' };
}

/**
 * Google Play satın alma doğrula (consumable).
 * googleapis paketi ve GOOGLE_APPLICATION_CREDENTIALS veya GOOGLE_PLAY_SERVICE_ACCOUNT_JSON gerekir.
 * @param {string} packageName - Android package name (com.litxtech.mykbs)
 * @param {string} productId - Product id (mykbs_paket_starter vb.)
 * @param {string} purchaseToken - Purchase token from client
 * @returns {{ valid: boolean, transactionId?: string, productId?: string, error?: string }}
 */
async function verifyGooglePurchase(packageName, productId, purchaseToken) {
  if (!packageName || !productId || !purchaseToken) {
    return { valid: false, error: 'Google IAP için packageName, productId ve purchaseToken gerekli.' };
  }

  try {
    const google = require('googleapis');
    const { google: g } = google;
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    const authClient = await auth.getClient();
    const androidpublisher = g.androidpublisher({ version: 'v3', auth: authClient });
    const res = await androidpublisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });
    const purchase = res.data;
    if (!purchase || purchase.purchaseState !== 0) {
      return { valid: false, error: 'Satın alma geçerli değil veya iptal.' };
    }
    return {
      valid: true,
      transactionId: purchaseToken,
      productId,
    };
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('googleapis')) {
      return { valid: false, error: 'Google Play doğrulama için googleapis paketi yükleyin: npm install googleapis' };
    }
    const msg = err.message || err.toString();
    const status = err.response?.status;
    return { valid: false, error: status ? `Google API ${status}: ${msg}` : msg };
  }
}

module.exports = { verifyAppleReceipt, verifyGooglePurchase };
