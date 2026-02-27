/**
 * Paket ve ek kredi tanımları (TL, bildirim kredisi).
 * Paketler süreye bağlı değil; kredi bitene kadar geçerli.
 */

const TRIAL_DAYS = 3;
const TRIAL_CREDITS = 100;

const PACKAGES = {
  starter: { credits: 250, priceTL: 399, label: 'Starter' },
  pro: { credits: 1000, priceTL: 1199, label: 'Pro', badge: 'En Çok Tercih Edilen' },
  business: { credits: 3000, priceTL: 2999, label: 'Business' },
  enterprise: { credits: 10000, priceTL: 9999, label: 'Enterprise' },
};

const ADDONS = [
  { credits: 200, priceTL: 249 },
  { credits: 500, priceTL: 549 },
];

const VALID_PAKET_KEYS = ['deneme', 'starter', 'pro', 'business', 'enterprise'];

function getPackageCredits(paket) {
  if (paket === 'deneme') return TRIAL_CREDITS;
  return PACKAGES[paket]?.credits ?? 0;
}

function setTrialDefaults() {
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + TRIAL_DAYS);
  return { paket: 'deneme', kota: TRIAL_CREDITS, trialEndsAt: endsAt };
}

/** İstek sahibi tesis bildirim gönderebilir mi? (deneme süresi / kredi kontrolü) */
function canSendBildirim(tesis) {
  if (!tesis) return { allowed: false, reason: 'no_tesis' };
  if (tesis.paket === 'deneme' && tesis.trialEndsAt && new Date() > new Date(tesis.trialEndsAt)) {
    return { allowed: false, reason: 'trial_ended' };
  }
  if ((tesis.kullanilanKota ?? 0) >= (tesis.kota ?? 0)) {
    return { allowed: false, reason: 'no_credits' };
  }
  return { allowed: true };
}

module.exports = {
  TRIAL_DAYS,
  TRIAL_CREDITS,
  PACKAGES,
  ADDONS,
  VALID_PAKET_KEYS,
  getPackageCredits,
  setTrialDefaults,
  canSendBildirim,
};
