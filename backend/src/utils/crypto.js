import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from env, padded/truncated to 32 bytes.
 * @returns {Buffer}
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY env var is required');
  const buf = Buffer.alloc(32);
  Buffer.from(raw, 'utf8').copy(buf);
  return buf;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} base64 encoded iv:tag:ciphertext
 */
export function encrypt(plaintext) {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypt AES-256-GCM encrypted string.
 * @param {string} encryptedStr base64 encoded iv:tag:ciphertext
 * @returns {string} plaintext
 */
export function decrypt(encryptedStr) {
  if (!encryptedStr) return '';
  const key = getKey();
  const [ivB64, tagB64, dataB64] = encryptedStr.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
