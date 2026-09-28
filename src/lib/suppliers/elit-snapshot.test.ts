import { SupplierIntegrationType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnectorFactory } from './connectors';
import { normalizeElitSnapshot, registerElitSnapshotConnector } from './elit-snapshot';

const snapshot = {
  supplier: 'elit' as const,
  externalId: '6358',
  sku: '981-000612',
  ean: '97855114976',
  title: 'Auricular Logitech',
  description: 'Descripción',
  brand: 'Logitech',
  category: 'Auriculares',
  stock: 5,
  images: ['https://images.elit.com.ar/p/6358/i/image_l.webp'],
  attributes: { warranty: '12 meses' },
  sourceUrl: 'https://www.elit.com.ar/producto/6358-auricular',
  rawData: { code: 6358 },
  pricing: {
    supplierPriceUsd: 10,
    exchangeRateArsPerUsd: 1_535,
    supplierPriceArs: 15_350,
    vatPercentage: 21,
    vatAmountUsd: 2.1,
    vatAmountArs: 3_223.5,
    supplierCostWithVatUsd: 12.1,
    supplierCostWithVatArs: 18_573.5,
  },
};

describe('Elit extension snapshot adapter', () => {
  it('normalizes the snapshot into the shared supplier product contract', () => {
    expect(normalizeElitSnapshot(snapshot, 20_000)).toMatchObject({
      externalId: '6358',
      cost: 20_000,
      currency: 'ARS',
      stock: 5,
      rawData: {
        code: 6358,
        sourceUrl: snapshot.sourceUrl,
        capturedPricing: snapshot.pricing,
      },
    });
  });

  it('resolves the product through the versioned factory capability', async () => {
    const logger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    const factory = registerElitSnapshotConnector(new SupplierConnectorFactory(logger));
    const connector = factory.make({
      supplierId: 'supplier-1',
      slug: 'elit',
      integrationType: SupplierIntegrationType.SCRAPING,
      connectorKey: 'elit-snapshot-v1',
      sourceSnapshot: snapshot,
      normalizedCostArs: 20_000,
    });

    await expect(connector.getProduct('6358')).resolves.toMatchObject({ externalId: '6358', cost: 20_000 });
    await expect(connector.getProducts()).rejects.toMatchObject({ code: 'CAPABILITY_NOT_SUPPORTED' });
  });
});
