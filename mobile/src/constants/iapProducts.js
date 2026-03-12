/**
 * Apple App Store ve Google Play In-App Purchase Product ID'leri.
 * App Store Connect ve Play Console'da aynı ID'lerle ürün oluşturulmalı.
 * Doküman: docs/IAP_APPLE_GOOGLE_AYARLARI.md
 */

/** Uygulama satın alınabilir paketleri: sadece starter, pro, business. */
export const IAP_PRODUCT_IDS = {
  apple: {
    starter: 'com.litxtech.kbsprime.paket.starter.credits',
    pro: 'com.litxtech.kbsprime.paket.pro.credits',
    business: 'com.litxtech.kbsprime.paket.business.credits',
  },
  google: {
    starter: 'mykbs_paket_starter',
    pro: 'mykbs_paket_pro',
    business: 'mykbs_paket_business',
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
