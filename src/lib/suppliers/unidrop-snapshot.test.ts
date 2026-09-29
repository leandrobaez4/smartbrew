import { SupplierIntegrationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnectorFactory } from './connectors';
import { normalizeUnidropSnapshot, registerUnidropSnapshotConnector } from './unidrop-snapshot';

const snapshot = {
  version: 1 as const,
  supplier: 'unidrop' as const,
  sourceProductId: '398',
  externalId: '398:MINASPGATITO',
  sku: 'MINASPGATITO',
  ean: null,
  title: 'Mini aspiradora de escritorio',
  description: 'Aspiradora de escritorio portátil 1200mAh.',
  brand: null,
  category: 'Hogar',
  costArs: 14_169,
  priceWithProfitArs: 14_169,
  stock: 40,
  images: ['https://www.unidrop.com.ar/images/catalogue/398-1.webp'],
  package: { weightGrams: 270, heightCm: 9, widthCm: 9, lengthCm: 10 },
  shippingReference: { platform: 'TIENDANUBE' as const, amountArs: 9_999.99 },
  attributes: { batteryCapacity: '1200mAh', color: 'Negro' },
  sourceUrl: 'https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3',
  capturedAt: '2026-09-29T17:00:00-03:00',
};

describe('Unidrop browser snapshot adapter', () => {
  it('normalizes product 398 and keeps platform shipping as reference only', () => {
    expect(normalizeUnidropSnapshot(snapshot)).toMatchObject({
      externalId: '398:MINASPGATITO',
      sku: 'MINASPGATITO',
      cost: 14_169,
      currency: 'ARS',
      stock: 40,
      pricing: { supplierCurrency: 'ARS', supplierCostWithTaxesArs: 14_169 },
      rawData: {
        sourceProductId: '398',
        shippingReference: { platform: 'TIENDANUBE', amountArs: 9_999.99 },
      },
    });
  });

  it('registers only the product capability and rejects catalog synchronization', async () => {
    const logger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    const factory = registerUnidropSnapshotConnector(new SupplierConnectorFactory(logger));
    const connector = factory.make({
      supplierId: 'unidrop-supplier',
      slug: 'unidrop',
      integrationType: SupplierIntegrationType.SCRAPING,
      connectorKey: 'unidrop-snapshot-v1',
      sourceSnapshot: snapshot,
    });

    expect(connector.capabilities).toEqual(['product']);
    await expect(connector.getProduct('398:MINASPGATITO')).resolves.toMatchObject({ stock: 40 });
    await expect(connector.getProducts()).rejects.toMatchObject({
      code: 'CAPABILITY_NOT_SUPPORTED',
      operation: 'getProducts',
    });
  });

  it('rejects mismatched identities, credentials-shaped fields and non-Unidrop URLs', () => {
    expect(() => normalizeUnidropSnapshot({ ...snapshot, externalId: '398:OTHER' })).toThrow('productId:SKU');
    expect(() => normalizeUnidropSnapshot({ ...snapshot, cookie: 'session=secret' })).toThrow();
    expect(() => normalizeUnidropSnapshot({ ...snapshot, sourceUrl: 'https://example.com/panel/catalogue/398' })).toThrow();
  });
});
