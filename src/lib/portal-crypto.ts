import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const randomSecret = () => randomBytes(32).toString('hex');
export const hashSecret = (value: string) => createHash('sha256').update(value).digest('hex');

function key() {
  const value = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('Instagram encryption is not configured');
  return Buffer.from(value, 'hex');
}

export function sealToken(token: string, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(owner));
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(b => b.toString('base64url')).join('.');
}

export function openToken(value: string, owner: string) {
  const [iv, tag, ciphertext] = value.split('.').map(v => Buffer.from(v, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAAD(Buffer.from(owner));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
