import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSupplierCredential } from './supplier-credentials';
import { parseSupplierFormData, parseSupplierInput, supplierCreateData, supplierUpdateData } from './supplier-form';

function validForm(overrides: Record<string, string> = {}) {
  const values = {
    name: 'Proveedor Uno',
    slug: 'proveedor-uno',
    type: 'mayorista',
    website: 'https://supplier.example',
    apiUrl: 'https://api.supplier.example/v1',
    integrationType: 'API',
    status: 'ACTIVE',
    apiKey: 'secret-key',
    apiSecret: '',
    username: '',
    password: '',
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe('supplier form', () => {
  const previousKey = process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY = 'cd'.repeat(32);
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.SUPPLIER_CREDENTIALS_ENCRYPTION_KEY = previousKey;
  });

  it('normalizes supplier data and encrypts submitted credentials', () => {
    const parsed = parseSupplierFormData(validForm());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const data = supplierCreateData(parsed.data, 'supplier-1');
    expect(data.slug).toBe('proveedor-uno');
    expect(data.apiKeyEncrypted).not.toBe('secret-key');
    expect(openSupplierCredential(String(data.apiKeyEncrypted), 'supplier-1', 'apiKey')).toBe('secret-key');
  });

  it('rejects invalid slugs and URLs', () => {
    const parsed = parseSupplierFormData(validForm({ slug: 'Proveedor Uno', website: 'not-a-url' }));
    expect(parsed.success).toBe(false);
  });

  it('accepts API payloads without optional fields', () => {
    const parsed = parseSupplierInput({ name: 'Proveedor Manual', slug: 'proveedor-manual' });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.integrationType).toBe('MANUAL');
    expect(parsed.data.status).toBe('ACTIVE');
    expect(parsed.data.apiKey).toBeNull();
  });

  it('preserves stored credentials when edit fields are left blank', () => {
    const parsed = parseSupplierFormData(validForm({ apiKey: '', apiSecret: '', username: '', password: '' }));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const data = supplierUpdateData(parsed.data, 'supplier-1');
    expect(data).not.toHaveProperty('apiKeyEncrypted');
    expect(data).not.toHaveProperty('apiSecretEncrypted');
    expect(data).not.toHaveProperty('usernameEncrypted');
    expect(data).not.toHaveProperty('passwordEncrypted');
  });
});
