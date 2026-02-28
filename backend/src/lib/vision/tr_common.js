/**
 * Shared helpers for TR ID and TR Driver License parsing.
 */

/** TC Kimlik no algorithm check (10th and 11th digit). */
function validateTC(tc) {
  if (!tc || !/^\d{11}$/.test(tc)) return false;
  const d = tc.split('').map(Number);
  if (d[0] === 0) return false;
  const k10 = (d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7]);
  const k10digit = ((k10 % 10) + 10) % 10;
  if (k10digit !== d[9]) return false;
  const sum10 = d[0] + d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7] + d[8] + d[9];
  const k11digit = sum10 % 10;
  return k11digit === d[10];
}

function normalizeDigits(str) {
  return (str || '').replace(/[O]/g, '0').replace(/[lI]/g, '1').replace(/\D/g, '');
}

module.exports = {
  validateTC,
  normalizeDigits,
};
