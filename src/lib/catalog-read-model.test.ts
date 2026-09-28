import { describe, expect, it } from 'vitest';
import { affiliateCatalogItem, mergeCatalogItems, supplierCatalogItem } from './catalog-read-model';

describe('combined catalog read model', () => {
  it('keeps affiliate products explicitly separated from supplier offers', () => {
    const item = affiliateCatalogItem({
      id: 'affiliate-1', title: 'Cafetera', externalId: 'MLA1', marketplace: 'MERCADO_LIBRE', status: 'ACTIVE',
      price: 20_000, currency: 'ARS', imageUrl: null, affiliateUrl: 'https://meli.la/example', updatedAt: new Date('2026-09-01'),
    });
    expect(item).toMatchObject({
      catalogKey: 'affiliate:affiliate-1', sourceKind: 'AFFILIATE_MARKETPLACE', productId: 'affiliate-1',
      marketplace: 'MERCADO_LIBRE', availability: 'UNKNOWN', href: '/admin/products/affiliate-1',
    });
    expect(item).not.toHaveProperty('supplierProductId');
  });

  it('identifies supplier provenance, availability and published price', () => {
    const item = supplierCatalogItem({
      id: 'supplier-product-1', title: 'Auricular', externalId: '6358', sku: 'LOG-H111', active: true, stock: 8,
      imageUrl: null, publishedPrice: 30_000, calculatedPrice: 28_000, currency: 'ARS',
      updatedAt: new Date('2026-09-02'), lastSyncAt: new Date('2026-09-02'), listingStatus: 'ACTIVE',
      supplier: { id: 'supplier-1', name: 'Elit', slug: 'elit', status: 'ACTIVE' },
    });
    expect(item).toMatchObject({
      catalogKey: 'supplier:supplier-product-1', sourceKind: 'SUPPLIER', supplierName: 'Elit',
      availability: 'AVAILABLE', price: 30_000, priceKind: 'PUBLISHED', href: '/admin/opportunities/supplier-product-1',
    });
    expect(item).not.toHaveProperty('productId');
  });

  it('merges both sources by most recent update without changing their identities', () => {
    const affiliate = affiliateCatalogItem({
      id: 'a', title: 'A', externalId: null, marketplace: 'MERCADO_LIBRE', status: 'ACTIVE', price: null,
      currency: null, imageUrl: null, affiliateUrl: null, updatedAt: new Date('2026-09-01'),
    });
    const supplier = supplierCatalogItem({
      id: 's', title: 'S', externalId: '1', sku: null, active: true, stock: 0, imageUrl: null,
      publishedPrice: null, calculatedPrice: 10, currency: 'ARS', updatedAt: new Date('2026-09-03'),
      lastSyncAt: new Date('2026-09-03'), listingStatus: null,
      supplier: { id: 'p', name: 'Proveedor', slug: 'proveedor', status: 'ACTIVE' },
    });
    expect(mergeCatalogItems([affiliate], [supplier]).map((item) => item.catalogKey)).toEqual(['supplier:s', 'affiliate:a']);
  });
});
