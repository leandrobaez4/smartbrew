import { MarketplaceListingStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { syncMarketplaceStock } from './supplier-stock-sync';

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    marketplaceItemId: 'MLA123',
    price: new Prisma.Decimal(10_000),
    status: MarketplaceListingStatus.ACTIVE,
    supplierProduct: {
      id: 'product-1',
      cost: new Prisma.Decimal(5_000),
      stock: 4,
    },
    ...overrides,
  };
}

function dependencies(listings: ReturnType<typeof listing>[]) {
  return {
    findListings: vi.fn().mockResolvedValue(listings),
    stockClient: { updateAvailableQuantity: vi.fn().mockResolvedValue(undefined) },
    updateListing: vi.fn().mockResolvedValue(undefined),
    logger: vi.fn().mockResolvedValue(undefined),
    marketplaceFee: 500,
    shippingCost: 500,
    taxes: 0,
    extraCosts: 0,
    minimumProfitPercentage: 20,
    minimumProfitAmount: 0,
  };
}

describe('supplier marketplace stock synchronization', () => {
  it('pauses a listing and sends zero when the supplier has no stock', async () => {
    const deps = dependencies([listing({ supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(5_000), stock: 0 } })]);

    const result = await syncMarketplaceStock(deps);

    expect(deps.stockClient.updateAvailableQuantity).toHaveBeenCalledWith('MLA123', 0);
    expect(deps.updateListing).toHaveBeenCalledWith('listing-1', MarketplaceListingStatus.PAUSED);
    expect(deps.logger).toHaveBeenCalledWith('WARN', 'SUPPLIER_OUT_OF_STOCK', expect.any(String), expect.objectContaining({ listingId: 'listing-1' }));
    expect(result).toMatchObject({ paused: 1, synchronized: 1, failed: 0 });
  });

  it('treats stock below the configured minimum as unavailable', async () => {
    const deps = { ...dependencies([listing()]), minimumStock: 5 };
    const result = await syncMarketplaceStock(deps);
    expect(deps.stockClient.updateAvailableQuantity).toHaveBeenCalledWith('MLA123', 0);
    expect(deps.updateListing).toHaveBeenCalledWith('listing-1', MarketplaceListingStatus.PAUSED);
    expect(result.paused).toBe(1);
  });

  it('does not pause an out-of-stock listing when automatic pausing is disabled', async () => {
    const deps = {
      ...dependencies([listing({ supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(5_000), stock: 0 } })]),
      pauseWhenNoStock: false,
    };
    const result = await syncMarketplaceStock(deps);
    expect(deps.stockClient.updateAvailableQuantity).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ synchronized: 0, paused: 0, failed: 0 });
  });

  it('logs a simulated stock update without writing to the marketplace or database in dry run', async () => {
    const deps = { ...dependencies([listing()]), dryRun: true };
    const result = await syncMarketplaceStock(deps);
    expect(deps.stockClient.updateAvailableQuantity).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ simulated: 1, synchronized: 0 });
    expect(deps.logger).toHaveBeenCalledWith(
      'INFO', 'dropshipping_dry_run', 'Dry run: marketplace_stock_update',
      expect.objectContaining({ operation: 'marketplace_stock_update', listingId: 'listing-1', availableQuantity: 4 }),
    );
  });

  it('simulates pausing an unprofitable active listing without external writes', async () => {
    const deps = { ...dependencies([listing({ price: new Prisma.Decimal(5_500) })]), dryRun: true };
    const result = await syncMarketplaceStock(deps);
    expect(deps.stockClient.updateAvailableQuantity).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ simulated: 1, skippedUnprofitable: 1, paused: 0 });
  });

  it('reactivates a profitable listing with exactly the supplier stock', async () => {
    const deps = dependencies([listing({ status: MarketplaceListingStatus.PAUSED })]);

    const result = await syncMarketplaceStock(deps);

    expect(deps.stockClient.updateAvailableQuantity).toHaveBeenCalledWith('MLA123', 4);
    expect(deps.updateListing).toHaveBeenCalledWith('listing-1', MarketplaceListingStatus.ACTIVE);
    expect(result.reactivated).toBe(1);
  });

  it('keeps an unprofitable listing paused and does not expose supplier stock', async () => {
    const deps = dependencies([listing({
      status: MarketplaceListingStatus.PAUSED,
      price: new Prisma.Decimal(5_500),
    })]);

    const result = await syncMarketplaceStock(deps);

    expect(deps.stockClient.updateAvailableQuantity).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(deps.logger).toHaveBeenCalledWith('WARN', 'LOW_MARGIN', expect.any(String), expect.objectContaining({ listingId: 'listing-1' }));
    expect(result.skippedUnprofitable).toBe(1);
  });

  it('pauses an active unprofitable listing remotely instead of leaving stale stock', async () => {
    const deps = dependencies([listing({ price: new Prisma.Decimal(5_500) })]);

    await syncMarketplaceStock(deps);

    expect(deps.stockClient.updateAvailableQuantity).toHaveBeenCalledWith('MLA123', 0);
    expect(deps.updateListing).toHaveBeenCalledWith('listing-1', MarketplaceListingStatus.PAUSED);
  });

  it('isolates provider failures and continues synchronizing the remaining listings', async () => {
    const deps = dependencies([
      listing(),
      listing({ id: 'listing-2', marketplaceItemId: 'MLA456', supplierProduct: { id: 'product-2', cost: new Prisma.Decimal(5_000), stock: 2 } }),
    ]);
    deps.stockClient.updateAvailableQuantity
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(undefined);

    const result = await syncMarketplaceStock(deps);

    expect(deps.stockClient.updateAvailableQuantity).toHaveBeenNthCalledWith(2, 'MLA456', 2);
    expect(result).toMatchObject({ synchronized: 1, failed: 1 });
  });
});
