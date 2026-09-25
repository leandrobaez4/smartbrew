import { describe, expect, it } from 'vitest';
import { decodeElitImportPayload, ElitImportProductSchema } from './elit-import';

const product = {
  supplier: 'elit', externalId: '6358', sku: '981-000612', ean: '97855114976', title: 'Auricular',
  description: 'Descripción', brand: 'Logitech', category: 'Auriculares', stock: 5,
  images: ['https://images.elit.com.ar/p/6358/i/image_l.webp'], attributes: {},
  sourceUrl: 'https://www.elit.com.ar/producto/6358-auricular', rawData: {},
  pricing: {
    supplierPriceUsd: 10, exchangeRateArsPerUsd: 1535, supplierPriceArs: 15350,
    vatPercentage: 21, vatAmountUsd: 2.1, vatAmountArs: 3223.5,
    supplierCostWithVatUsd: 12.1, supplierCostWithVatArs: 18573.5,
  },
};

describe('Elit import payload', () => {
  it('decodes a validated base64url product', () => {
    const encoded = Buffer.from(JSON.stringify(product)).toString('base64url');
    expect(decodeElitImportPayload(encoded)?.externalId).toBe('6358');
  });

  it('rejects unexpected origins and image hosts', () => {
    expect(ElitImportProductSchema.safeParse({ ...product, sourceUrl: 'https://evil.test/producto/6358' }).success).toBe(false);
    expect(ElitImportProductSchema.safeParse({ ...product, images: ['https://evil.test/image.jpg'] }).success).toBe(false);
  });
});
