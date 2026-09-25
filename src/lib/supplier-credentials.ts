import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';

function encryptionKey() {
  const value = process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error('Supplier credential encryption is not configured');
  }
  return Buffer.from(value, 'hex');
}

export function sealSupplierCredential(value: string, supplierId: string, field: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`${supplierId}:${field}`));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function openSupplierCredential(value: string, supplierId: string, field: string) {
  const parts = value.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted supplier credential');
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv(algorithm, encryptionKey(), iv);
  decipher.setAAD(Buffer.from(`${supplierId}:${field}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
