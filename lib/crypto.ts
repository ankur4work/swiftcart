import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY = Buffer.from(env.SESSION_SECRET, 'hex');
const VERSION = 'v1';

if (KEY.length !== 32) {
  throw new Error('SESSION_SECRET must decode to 32 bytes');
}

/**
 * Envelope format: v1:<iv b64>:<gcm tag b64>:<ciphertext b64>
 *
 * The version prefix is what makes a future key rotation or algorithm change
 * possible without a migration that has to guess at the shape of old rows.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Malformed ciphertext');
  }
  const iv = Buffer.from(parts[1]!, 'base64');
  const tag = Buffer.from(parts[2]!, 'base64');
  const ct = Buffer.from(parts[3]!, 'base64');
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
