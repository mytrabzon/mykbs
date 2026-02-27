/**
 * Paket ve ek kredi tanımları (TL, bildirim kredisi).
 * Backend config/packages.js ile uyumlu.
 */

export const TRIAL_DAYS = 3;
export const TRIAL_CREDITS = 100;

export const PACKAGES = [
  { id: 'starter', credits: 250, priceTL: 399, label: 'Starter' },
  { id: 'pro', credits: 1000, priceTL: 1199, label: 'Pro', badge: 'En Çok Tercih Edilen' },
  { id: 'business', credits: 3000, priceTL: 2999, label: 'Business' },
  { id: 'enterprise', credits: 10000, priceTL: 9999, label: 'Enterprise' },
];

export const ADDONS = [
  { credits: 200, priceTL: 249 },
  { credits: 500, priceTL: 549 },
];

/** Paywall’da gösterilecek 3 ana paket (Starter, Pro, Business) */
export const PAYWALL_PACKAGES = PACKAGES.filter((p) => ['starter', 'pro', 'business'].includes(p.id));

export const WELCOME_TRIAL_MESSAGE =
  'Hoş geldiniz! 3 gün boyunca 100 oda bildirimi ücretsiz.';

export const TRIAL_END_MESSAGE =
  'Deneme süren tamamlandı. Bildirimlerine kesintisiz devam etmek için paket seç.';

export const CREDITS_DEPLETED_MESSAGE =
  'Bildirim hakkın doldu. Devam etmek için paket seç.';
