/**
 * Loglarda MRZ ham string'i maskele (roadmap: A*********9).
 * Sentry/console'a full MRZ basılmamalı.
 */

/**
 * MRZ raw string'i maskeleyerek döner (ilk 1 + son 1 karakter + ortası yıldız).
 * @param {string} raw
 * @param {number} visibleEnd - sonda görünecek karakter sayısı (varsayılan 1)
 * @returns {string}
 */
export function maskMrz(raw, visibleEnd = 1) {
  if (!raw || typeof raw !== 'string') return '***';
  const s = raw.replace(/\s/g, '').trim();
  if (s.length <= 2) return '**';
  const first = s[0];
  const last = s.slice(-visibleEnd);
  const mid = '*'.repeat(Math.min(s.length - 1 - visibleEnd, 12));
  return first + mid + last;
}

export default maskMrz;
