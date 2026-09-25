import { Supplier, SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { supplierResponse } from './suppliers';

describe('supplier API response', () => {
  it('reports configured credentials without exposing ciphertext', () => {
    const supplier: Supplier = {
      id: 'supplier-1',
      name: 'Proveedor Uno',
      slug: 'proveedor-uno',
      type: null,
      website: null,
      apiUrl: null,
      apiKeyEncrypted: 'ciphertext',
      apiSecretEncrypted: null,
      usernameEncrypted: null,
      passwordEncrypted: 'ciphertext',
      integrationType: SupplierIntegrationType.API,
      status: SupplierStatus.ACTIVE,
      lastSyncAt: null,
      createdAt: new Date('2026-09-24T00:00:00Z'),
      updatedAt: new Date('2026-09-24T00:00:00Z'),
    };

    const response = supplierResponse(supplier);
    expect(response.credentialsConfigured).toEqual({ apiKey: true, apiSecret: false, username: false, password: true });
    expect(JSON.stringify(response)).not.toContain('ciphertext');
    expect(response).not.toHaveProperty('apiKeyEncrypted');
  });
});
