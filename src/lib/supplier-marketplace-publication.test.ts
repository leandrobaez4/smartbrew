import { MarketplaceListingStatus, Prisma, SupplierIntegrationType, SupplierProductEditorialStatus, SupplierStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { MarketplacePublicationError } from './mercado-libre-publisher';
import { publishSupplierProduct } from './supplier-marketplace-publication';

const product = {
  id: 'product-1',
  supplierId: 'supplier-1',
  externalId: 'external-1',
  sku: null,
  ean: null,
  title: 'Producto',
  description: 'Descripción',
  brand: 'Marca',
  category: 'MLA123',
  cost: new Prisma.Decimal(5_000),
  currency: 'ARS',
  stock: 3,
  images: ['https://example.com/product.jpg'],
  attributes: { BRAND: 'Marca' },
  rawData: {},
  editorialTitle: 'Producto revisado',
  editorialDescription: 'Descripción editorial revisada y aprobada para la publicación.',
  editorialBulletPoints: ['Característica real 1', 'Característica real 2', 'Característica real 3'],
  editorialHighlights: ['Destacado real 1', 'Destacado real 2'],
  editorialSeoKeywords: ['producto', 'marca'],
  editorialStatus: SupplierProductEditorialStatus.APPROVED,
  editorialError: null,
  editorialGeneratedAt: new Date(0),
  editorialReviewedAt: new Date(0),
  active: true,
  lastSyncAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
  supplier: {
    id: 'supplier-1', name: 'Supplier', slug: 'supplier', type: null, website: null, apiUrl: null,
    apiKeyEncrypted: null, apiSecretEncrypted: null, usernameEncrypted: null, passwordEncrypted: null,
    integrationType: SupplierIntegrationType.API, status: SupplierStatus.ACTIVE, lastSyncAt: null,
    createdAt: new Date(0), updatedAt: new Date(0),
  },
};

const request = {
  supplierProductId: 'product-1',
  marketplaceAccountId: 'account-1',
  marketplaceFee: 1_000,
  shippingCost: 500,
  taxes: 500,
  extraCosts: 0,
  targetMarginPercentage: 20,
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    findProduct: vi.fn().mockResolvedValue(product),
    publisher: { publish: vi.fn().mockResolvedValue({ marketplaceItemId: 'MLA123456' }) },
    linkListing: vi.fn().mockResolvedValue({ id: 'listing-1', marketplaceItemId: null, status: MarketplaceListingStatus.DRAFT }),
    syncListing: vi.fn().mockResolvedValue({ id: 'listing-1', status: MarketplaceListingStatus.ACTIVE }),
    failListing: vi.fn().mockResolvedValue(undefined),
    logger: vi.fn().mockResolvedValue(undefined),
    minimumMarginPercentage: 20,
    minimumProfitAmount: 0,
    ...overrides,
  };
}

describe('supplier marketplace publication', () => {
  it('validates profitability and publishes the complete supplier product', async () => {
    const deps = dependencies();
    const result = await publishSupplierProduct(request, deps);
    expect(deps.publisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Producto revisado', description: 'Descripción editorial revisada y aprobada para la publicación.', categoryId: 'MLA123', quantity: 3,
      images: ['https://example.com/product.jpg'], attributes: [{ id: 'BRAND', value_name: 'Marca' }],
      price: 8_750,
    }));
    expect(deps.syncListing).toHaveBeenCalledWith(expect.objectContaining({
      listingId: 'listing-1', marketplaceItemId: 'MLA123456', status: MarketplaceListingStatus.ACTIVE,
    }));
    expect(result.pricing.netProfit).toBeGreaterThanOrEqual(0);
  });

  it('publishes with the final price saved by the dashboard calculator', async () => {
    const deps = dependencies({
      findProduct: vi.fn().mockResolvedValue({
        ...product,
        pricing: {
          finalPriceArs: new Prisma.Decimal(12_345.67),
          targetMarginPercentage: new Prisma.Decimal(25),
          targetProfitArs: new Prisma.Decimal(2_000),
          totalCostArs: new Prisma.Decimal(10_345.67),
        },
      }),
    });
    await publishSupplierProduct(request, deps);
    expect(deps.publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ price: 12_345.67 }));
  });

  it('validates and logs a publication without creating a listing or calling the marketplace in dry run', async () => {
    const deps = dependencies({ dryRun: true });
    const result = await publishSupplierProduct(request, deps);
    expect(deps.linkListing).not.toHaveBeenCalled();
    expect(deps.publisher.publish).not.toHaveBeenCalled();
    expect(deps.syncListing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ listing: null, dryRun: true });
    expect(deps.logger).toHaveBeenCalledWith(
      'INFO', 'dropshipping_dry_run', 'Dry run: marketplace_publish',
      expect.objectContaining({ operation: 'marketplace_publish', supplierProductId: 'product-1', price: 8_750 }),
    );
  });

  it.each([
    ['without stock', { stock: 0 }],
    ['inactive supplier', { supplier: { ...product.supplier, status: SupplierStatus.INACTIVE } }],
    ['without cost', { cost: null }],
  ])('never publishes a product %s', async (_label, change) => {
    const deps = dependencies({ findProduct: vi.fn().mockResolvedValue({ ...product, ...change }) });
    await expect(publishSupplierProduct(request, deps)).rejects.toThrow();
    expect(deps.publisher.publish).not.toHaveBeenCalled();
  });

  it('records a safe error and preserves an external id after a partial provider failure', async () => {
    const deps = dependencies({
      publisher: { publish: vi.fn().mockRejectedValue(new MarketplacePublicationError('HTTP 400', 'MLA999')) },
    });
    await expect(publishSupplierProduct(request, deps)).rejects.toThrow('HTTP 400');
    expect(deps.failListing).toHaveBeenCalledWith('listing-1', 'MLA999');
    expect(deps.logger).toHaveBeenCalledWith('ERROR', 'mercado_libre_publication', expect.any(String), expect.objectContaining({
      listingId: 'listing-1', marketplaceItemId: 'MLA999', error: 'HTTP 400',
    }));
  });

  it('does not republish an active marketplace listing', async () => {
    const deps = dependencies({
      linkListing: vi.fn().mockResolvedValue({ id: 'listing-1', marketplaceItemId: 'MLA123', status: MarketplaceListingStatus.ACTIVE }),
    });
    await expect(publishSupplierProduct(request, deps)).rejects.toThrow('ya está publicado');
    expect(deps.publisher.publish).not.toHaveBeenCalled();
  });

  it('requires manual editorial approval before publishing', async () => {
    const deps = dependencies({
      findProduct: vi.fn().mockResolvedValue({ ...product, editorialStatus: SupplierProductEditorialStatus.READY }),
    });
    await expect(publishSupplierProduct(request, deps)).rejects.toThrow('revisarse y aprobarse');
    expect(deps.publisher.publish).not.toHaveBeenCalled();
  });
});
