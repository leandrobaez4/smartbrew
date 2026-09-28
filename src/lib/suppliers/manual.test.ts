import { SupplierIntegrationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { supplierProductData } from './catalog';
import { SupplierConnectorFactory } from './connectors';
import { normalizeManualSupplierSnapshot, registerManualSupplierConnector } from './manual';

const snapshot = {
  externalId: 'SECOND-001',
  sku: 'SECOND-SKU-001',
  title: 'Producto del segundo proveedor',
  cost: 12_500,
  currency: 'ars',
  stock: 7,
  images: ['https://example.com/product.jpg'],
  attributes: { color: 'negro' },
  rawData: { vendorId: 901 },
};

describe('manual supplier adapter', () => {
  it('normalizes a second provider without changing the shared product contract', () => {
    const normalized = normalizeManualSupplierSnapshot(snapshot);
    expect(normalized).toMatchObject({
      externalId: 'SECOND-001', sku: 'SECOND-SKU-001', cost: 12_500, currency: 'ARS', stock: 7,
      rawData: { vendorId: 901 },
    });
    expect(supplierProductData(normalized, new Date('2026-09-28'))).toMatchObject({
      externalId: 'SECOND-001', sku: 'SECOND-SKU-001', currency: 'ARS', stock: 7, active: true,
    });
  });

  it('registers independently and exposes only its real capability', async () => {
    const logger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    const factory = registerManualSupplierConnector(new SupplierConnectorFactory(logger));
    const connector = factory.make({
      supplierId: 'second-supplier',
      slug: 'second-supplier',
      integrationType: SupplierIntegrationType.MANUAL,
      connectorKey: 'manual-v1',
      sourceSnapshot: snapshot,
    });

    expect(connector.connectorKey).toBe('manual-v1');
    expect(connector.capabilities).toEqual(['product']);
    await expect(connector.getProduct('SECOND-001')).resolves.toMatchObject({ externalId: 'SECOND-001' });
    await expect(connector.createOrder({ reference: 'ORDER-1', items: [] })).rejects.toMatchObject({
      code: 'CAPABILITY_NOT_SUPPORTED', operation: 'createOrder',
    });
  });

  it('rejects ambiguous monetary snapshots before ingestion', () => {
    expect(() => normalizeManualSupplierSnapshot({ ...snapshot, currency: null })).toThrow('Currency is required');
    expect(() => normalizeManualSupplierSnapshot({ ...snapshot, stock: -1 })).toThrow();
  });
});
