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
  packageDimensions: { heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760 },
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
      images: ['https://example.com/product.jpg'], attributes: [
        { id: 'BRAND', value_name: 'Marca' },
        { id: 'SELLER_PACKAGE_HEIGHT', value_name: '8 cm' },
        { id: 'SELLER_PACKAGE_WIDTH', value_name: '18 cm' },
        { id: 'SELLER_PACKAGE_LENGTH', value_name: '22 cm' },
        { id: 'SELLER_PACKAGE_WEIGHT', value_name: '760 g' },
      ],
      price: 8_750,
      listingTypeId: 'gold_special',
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
          netMarginPercentage: new Prisma.Decimal(25),
          roiPercentage: new Prisma.Decimal(19.33),
          totalCostArs: new Prisma.Decimal(10_345.67),
          marketplaceListingTypeId: 'gold_pro',
          supplierCostWithTaxesArs: new Prisma.Decimal(8_000),
          marketplaceFixedFeeArs: new Prisma.Decimal(500),
          marketplaceFeePercentage: new Prisma.Decimal(10),
          productSearchCostArs: new Prisma.Decimal(1_000),
        },
      }),
    });
    await publishSupplierProduct(request, deps);
    expect(deps.publisher.publish).toHaveBeenCalledWith(expect.objectContaining({
      price: 15_384.62,
      listingTypeId: 'gold_pro',
    }));
  });

  it('reprices a saved dashboard calculation to the configured minimum margin', async () => {
    const deps = dependencies({
      findProduct: vi.fn().mockResolvedValue({
        ...product,
        pricing: {
          finalPriceArs: new Prisma.Decimal(10_000),
          targetMarginPercentage: new Prisma.Decimal(15),
          targetProfitArs: new Prisma.Decimal(1_500),
          netMarginPercentage: new Prisma.Decimal(15),
          roiPercentage: new Prisma.Decimal(17.65),
          totalCostArs: new Prisma.Decimal(8_500),
          marketplaceListingTypeId: 'gold_special',
          supplierCostWithTaxesArs: new Prisma.Decimal(8_000),
          marketplaceFixedFeeArs: new Prisma.Decimal(500),
          marketplaceFeePercentage: new Prisma.Decimal(10),
          productSearchCostArs: new Prisma.Decimal(1_000),
        },
      }),
    });

    await publishSupplierProduct(request, deps);
    expect(deps.publisher.publish).toHaveBeenCalledWith(expect.objectContaining({ price: 14_285.72 }));
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

  it('requires a new verification before publishing an expired Unidrop snapshot', async () => {
    const deps = dependencies({
      findProduct: vi.fn().mockResolvedValue({
        ...product,
        lastSyncAt: new Date('2026-09-20T00:00:00.000Z'),
        supplier: { ...product.supplier, type: 'unidrop-snapshot-v1', slug: 'unidrop' },
      }),
      snapshotExpiredHours: 72,
      now: new Date('2026-09-29T18:00:00.000Z'),
    });
    await expect(publishSupplierProduct(request, deps)).rejects.toThrow('snapshot de Unidrop venció');
    expect(deps.publisher.publish).not.toHaveBeenCalled();
  });
});
