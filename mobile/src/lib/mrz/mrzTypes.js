/**
 * MRZ payload tipi (roadmap uyumlu).
 * docType: 'P' = Pasaport (TD3), 'ID' = Kimlik (TD1), 'OTHER'
 * checks.ok: check digit ve validasyon sonucu
 * @typedef {Object} MrzPayload
 * @property {'P'|'ID'|'OTHER'} docType
 * @property {string} issuingCountry
 * @property {string} surname
 * @property {string} givenNames
 * @property {string} passportNumber
 * @property {string} nationality
 * @property {string} birthDate   ISO date
 * @property {'M'|'F'|'X'|'U'} sex
 * @property {string} expiryDate  ISO date
 * @property {string} raw
 * @property {{ ok: boolean; reason?: string }} checks
 */

/** @type {MrzPayload} */
export const emptyMrzPayload = () => ({
  docType: 'OTHER',
  issuingCountry: '',
  surname: '',
  givenNames: '',
  passportNumber: '',
  nationality: '',
  birthDate: '',
  sex: 'U',
  expiryDate: '',
  raw: '',
  checks: { ok: false },
});

export default emptyMrzPayload;
