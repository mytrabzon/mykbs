/**
 * Vize kontrolü: Pasaporttaki belge bitiş tarihini (MRZ expiry) hesapla, uyarı ver.
 * MRZ'de expiry format: YYMMDD (örn. 301231 = 2030-12-31)
 */
export function parseMrzExpiry(expiryStr) {
  if (!expiryStr || typeof expiryStr !== 'string') return null;
  const s = expiryStr.replace(/\s/g, '').trim();
  if (s.length < 6) return null;
  const yy = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(2, 4), 10);
  const dd = parseInt(s.slice(4, 6), 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  const year = yy >= 0 && yy <= 99 ? 2000 + yy : yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(year, mm - 1, dd);
  if (date.getFullYear() !== year || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return date;
}

/** Bitiş tarihi bugünden kaç gün sonra? Negatif = süresi geçmiş */
export function daysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const exp = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  return Math.floor((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Uyarı mesajı döndürür: null = uyarı yok, string = gösterilecek uyarı
 */
export function getVisaWarningFromMrz(expiryStr) {
  const date = parseMrzExpiry(expiryStr);
  if (!date) return null;
  const days = daysUntilExpiry(date);
  if (days === null) return null;
  if (days < 0) return 'Belge süresi geçmiş. Kontrol edin.';
  if (days <= 30) return `Belge ${days} gün içinde sona erecek.`;
  if (days <= 90) return `Belge ${days} gün içinde sona erecek.`;
  return null;
}

export function getVisaWarningFromDate(expiryDate) {
  const days = daysUntilExpiry(expiryDate);
  if (days === null) return null;
  if (days < 0) return 'Belge süresi geçmiş. Kontrol edin.';
  if (days <= 30) return `Belge ${days} gün içinde sona erecek.`;
  if (days <= 90) return `Belge ${days} gün içinde sona erecek.`;
  return null;
}
