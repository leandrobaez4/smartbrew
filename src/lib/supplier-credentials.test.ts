import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSupplierCredential, sealSupplierCredential } from './supplier-credentials';

describe('supplier credentials', () => {
  const previousKey = process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY = 'ab'.repeat(32);
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY = previousKey;
  });

  it('encrypts credentials without retaining plaintext', () => {
    const sealed = sealSupplierCredential('top-secret', 'supplier-1', 'apiKey');

    expect(sealed).not.toContain('top-secret');
    expect(openSupplierCredential(sealed, 'supplier-1', 'apiKey')).toBe('top-secret');
  });

  it('binds a credential to its supplier and field', () => {
    const sealed = sealSupplierCredential('top-secret', 'supplier-1', 'apiKey');

    expect(() => openSupplierCredential(sealed, 'supplier-2', 'apiKey')).toThrow();
    expect(() => openSupplierCredential(sealed, 'supplier-1', 'password')).toThrow();
  });

  it('requires a dedicated 32-byte encryption key', () => {
    process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY = 'short';

    expect(() => sealSupplierCredential('secret', 'supplier-1', 'apiKey')).toThrow(
      'Supplier credential encryption is not configured',
    );
  });
});
