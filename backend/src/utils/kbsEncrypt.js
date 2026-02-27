/**
 * KBS web servis şifresi encrypt/decrypt — DB'de plain kalmasın.
 * KBS_SECRET_KEY env (32 byte hex veya base64) kullanılır.
 */
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;

function getKey() {
  const raw = process.env.KBS_SECRET_KEY || process.env.JWT_SECRET || 'mykbs-default-kbs-encryption-key-32bytes!!';
  if (Buffer.isBuffer(raw)) return raw.slice(0, KEY_LEN);
  const buf = Buffer.from(raw, 'utf8');
  if (buf.length >= KEY_LEN) return buf.slice(0, KEY_LEN);
  return crypto.scryptSync(raw, 'mykbs-salt', KEY_LEN);
}

function encrypt(plain) {
  if (plain == null || plain === '') return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(encBase64) {
  if (encBase64 == null || encBase64 === '') return '';
  const key = getKey();
  const buf = Buffer.from(encBase64, 'base64');
  if (buf.length < IV_LEN + TAG_LEN) return '';
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const enc = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc) + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };
