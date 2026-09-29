import { describe, expect, it } from 'vitest';
import { decodeUnidropImportPayload, UnidropImportCommandSchema } from './unidrop-import';

const snapshot = {
  version: 1 as const,
  supplier: 'unidrop' as const,
  sourceProductId: '398',
  externalId: '398:MINASPGATITO',
  sku: 'MINASPGATITO',
  ean: null,
  title: 'Mini aspiradora de escritorio',
  description: 'Aspiradora portátil.',
  brand: null,
  category: 'Hogar',
  costArs: 14_169,
  priceWithProfitArs: 18_000,
  stock: 40,
  images: ['https://api.unidrop.com.ar/catalogue/398/main.webp'],
  package: { weightGrams: 270, heightCm: 9, widthCm: 9, lengthCm: 10 },
  shippingReference: { platform: 'TIENDANUBE' as const, amountArs: 9_999.99 },
  attributes: { color: 'Negro' },
  sourceUrl: 'https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3',
  capturedAt: '2026-09-29T17:00:00-03:00',
};

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('Unidrop import command', () => {
  it('decodes the versioned extension command for product 398', () => {
    const command = {
      version: 1,
      command: 'IMPORT_SUPPLIER_PRODUCT',
      supplierSlug: 'unidrop',
      externalId: snapshot.externalId,
      snapshot,
    };

    expect(UnidropImportCommandSchema.parse(command).snapshot).toEqual(snapshot);
    expect(decodeUnidropImportPayload(encode(command))).toEqual(snapshot);
  });

  it('rejects another supplier, mismatched identity and legacy bare snapshots', () => {
    const command = {
      version: 1,
      command: 'IMPORT_SUPPLIER_PRODUCT',
      supplierSlug: 'unidrop',
      externalId: snapshot.externalId,
      snapshot,
    };

    expect(decodeUnidropImportPayload(encode({ ...command, supplierSlug: 'elit' }))).toBeNull();
    expect(decodeUnidropImportPayload(encode({ ...command, externalId: '398:OTHER' }))).toBeNull();
    expect(decodeUnidropImportPayload(encode(snapshot))).toBeNull();
  });

  it('rejects malformed or oversized payloads', () => {
    expect(decodeUnidropImportPayload('not+base64')).toBeNull();
    expect(decodeUnidropImportPayload('A'.repeat(60_001))).toBeNull();
  });
});
