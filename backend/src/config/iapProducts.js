/**
 * Backend tarafında IAP product id → paket eşlemesi (mobile iapProducts.js ile uyumlu).
 */

const APPLE_PRODUCT_TO_PAKET = {
  'com.litxtech.kbsprime.paket.starter.credits': 'starter',
  'com.litxtech.kbsprime.paket.pro.credits': 'pro',
  'com.litxtech.kbsprime.paket.business.credits': 'business',
  'com.litxtech.kbsprime.paket.starter': 'starter',
  'com.litxtech.kbsprime.paket.pro': 'pro',
  'com.litxtech.kbsprime.paket.business': 'business',
  'com.litxtech.kbsprime.paket.enterprise': 'enterprise',
};

const GOOGLE_PRODUCT_TO_PAKET = {
  'mykbs_paket_starter': 'starter',
  'mykbs_paket_pro': 'pro',
  'mykbs_paket_business': 'business',
  'mykbs_paket_enterprise': 'enterprise',
};

function productIdToPaket(platform, productId) {
  if (!productId || typeof productId !== 'string') return null;
  const map = platform === 'ios' ? APPLE_PRODUCT_TO_PAKET : GOOGLE_PRODUCT_TO_PAKET;
  return map[productId] || null;
}

module.exports = { productIdToPaket, APPLE_PRODUCT_TO_PAKET, GOOGLE_PRODUCT_TO_PAKET };
