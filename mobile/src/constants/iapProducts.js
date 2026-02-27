/**
 * Apple App Store ve Google Play In-App Purchase Product ID'leri.
 * App Store Connect ve Play Console'da aynı ID'lerle ürün oluşturulmalı.
 * Doküman: docs/IAP_APPLE_GOOGLE_AYARLARI.md
 */

/** Uygulama paket id'si (starter, pro, business, enterprise) → mağaza product id */
export const IAP_PRODUCT_IDS = {
  // Apple (App Store Connect) — Bundle ID tabanlı öneri
  apple: {
    starter: 'com.litxtech.mykbs.paket.starter',
    pro: 'com.litxtech.mykbs.paket.pro',
    business: 'com.litxtech.mykbs.paket.business',
    enterprise: 'com.litxtech.mykbs.paket.enterprise',
  },
  // Google (Play Console In-app products)
  google: {
    starter: 'mykbs_paket_starter',
    pro: 'mykbs_paket_pro',
    business: 'mykbs_paket_business',
    enterprise: 'mykbs_paket_enterprise',
  },
};

/** Platforma göre product id listesi (react-native-iap getProducts için) */
export function getIAPProductIds(platform) {
  const map = platform === 'ios' ? IAP_PRODUCT_IDS.apple : IAP_PRODUCT_IDS.google;
  return Object.values(map);
}

/** Paket id (starter/pro/...) → platform product id */
export function getProductIdForPackage(packageId, platform) {
  const map = platform === 'ios' ? IAP_PRODUCT_IDS.apple : IAP_PRODUCT_IDS.google;
  return map[packageId] || null;
}
