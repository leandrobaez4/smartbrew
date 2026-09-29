import { describe, expect, it } from 'vitest';
import { buildManualMercadoLibrePublication } from './manual-mercado-libre-publication';

const source = {
  sku: 'MINASPGATITO',
  title: 'Mini aspiradora',
  description: 'Descripción del proveedor',
  editorialTitle: 'Mini aspiradora de escritorio portátil',
  editorialDescription: 'Contenido revisado para Mercado Libre.',
  editorialStatus: 'APPROVED',
  images: ['https://api.unidrop.com.ar/catalogue/398/main.webp'],
  attributes: { color: 'Negro', sellerPackageWeightGrams: 270, nested: { ignored: true } },
  stock: 40,
  pricing: { finalPriceArs: 24_999, marketplaceCategoryId: 'MLA1234' },
  package: { heightCm: 9, widthCm: 9, lengthCm: 10, weightGrams: 270 },
};

describe('manual Mercado Libre publication package', () => {
  it('uses approved content and exposes the required Unidrop SELLER_SKU', () => {
    const result = buildManualMercadoLibrePublication(source);

    expect(result).toMatchObject({
      title: source.editorialTitle,
      description: source.editorialDescription,
      categoryId: 'MLA1234',
      priceArs: 24_999,
      availableQuantity: 40,
      sellerSku: 'MINASPGATITO',
      package: source.package,
    });
    expect(result.attributes).toContainEqual({ id: 'SELLER_SKU', value_name: 'MINASPGATITO' });
    expect(result.attributes).toContainEqual({ id: 'SELLER_PACKAGE_WEIGHT', value_name: '270 g' });
    expect(result.attributes).not.toContainEqual(expect.objectContaining({ id: 'sellerPackageWeightGrams' }));
  });

  it('requires approved content, SKU, configured price and complete package dimensions', () => {
    expect(() => buildManualMercadoLibrePublication({ ...source, editorialStatus: 'PENDING' })).toThrow('aprobarse');
    expect(() => buildManualMercadoLibrePublication({ ...source, sku: null })).toThrow('SELLER_SKU');
    expect(() => buildManualMercadoLibrePublication({ ...source, pricing: null })).toThrow('precio final');
    expect(() => buildManualMercadoLibrePublication({ ...source, package: { ...source.package, weightGrams: undefined } })).toThrow();
  });
});
