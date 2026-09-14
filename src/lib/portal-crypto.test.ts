import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashSecret, randomSecret, sealToken, openToken } from './portal-crypto';
afterEach(() => vi.unstubAllEnvs());
describe('portal token protection', () => {
  it('hashes random invitation/session secrets', () => {
    const secret = randomSecret();
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSecret(secret)).not.toBe(secret);
    expect(randomSecret()).not.toBe(secret);
  });
  it('requires an explicit 256-bit encryption key', () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', '');
    expect(() => sealToken('private', 'owner')).toThrow();
  });
  it('encrypts with a fresh nonce and binds tokens to their owner', () => {
    vi.stubEnv('INSTAGRAM_TOKEN_ENCRYPTION_KEY', 'a'.repeat(64));
    const encrypted = sealToken('PRIVATE_TOKEN', 'member-a');
    expect(encrypted).not.toContain('PRIVATE_TOKEN');
    expect(openToken(encrypted, 'member-a')).toBe('PRIVATE_TOKEN');
    expect(() => openToken(encrypted, 'member-b')).toThrow();
    expect(sealToken('PRIVATE_TOKEN', 'member-a')).not.toBe(encrypted);
    const chunks = encrypted.split('.');
    chunks[2] = Buffer.from('tampered').toString('base64url');
    expect(() => openToken(chunks.join('.'), 'member-a')).toThrow();
  });
});
