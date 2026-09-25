import { MarketplaceListingStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { syncMarketplacePrices } from './supplier-price-sync';

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    marketplaceItemId: 'MLA123',
    price: new Prisma.Decimal(10_000),
    status: MarketplaceListingStatus.ACTIVE,
    supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(5_000) },
    ...overrides,
  };
}

function dependencies(listings: ReturnType<typeof listing>[]) {
  return {
    findListings: vi.fn().mockResolvedValue(listings),
    priceClient: {
      updatePrice: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
    },
    updateListing: vi.fn().mockResolvedValue(undefined),
    logger: vi.fn().mockResolvedValue(undefined),
    marketplaceFee: 500,
    shippingCost: 500,
    taxes: 0,
    extraCosts: 0,
    targetMarginPercentage: 25,
    minimumProfitPercentage: 20,
    minimumProfitAmount: 0,
    maximumPriceChangePercentage: 50,
    minimumPrice: 1,
    maximumPrice: 1_000_000,
  };
}

describe('supplier marketplace price synchronization', () => {
  it('recalculates and updates the price when the current margin remains profitable', async () => {
    const deps = dependencies([listing()]);

    const result = await syncMarketplacePrices(deps);

    expect(deps.priceClient.updatePrice).toHaveBeenCalledWith('MLA123', 8_000);
    expect(deps.updateListing).toHaveBeenCalledWith('listing-1', { price: 8_000 });
    expect(result).toMatchObject({ updated: 1, paused: 0, failed: 0 });
  });

  it('logs a simulated price update without writing to the marketplace or database in dry run', async () => {
    const deps = { ...dependencies([listing()]), dryRun: true };
    const result = await syncMarketplacePrices(deps);
    expect(deps.priceClient.updatePrice).not.toHaveBeenCalled();
    expect(deps.priceClient.pause).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ simulated: 1, updated: 0, paused: 0 });
    expect(deps.logger).toHaveBeenCalledWith(
      'INFO', 'dropshipping_dry_run', 'Dry run: marketplace_price_update',
      expect.objectContaining({ operation: 'marketplace_price_update', listingId: 'listing-1', proposedPrice: 8_000 }),
    );
  });

  it('logs a simulated pause without writing to the marketplace or database in dry run', async () => {
    const deps = {
      ...dependencies([listing({ supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(9_000) } })]),
      dryRun: true,
    };
    const result = await syncMarketplacePrices(deps);
    expect(deps.priceClient.pause).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(result).toMatchObject({ simulated: 1, paused: 0 });
  });

  it('generates a supplier price increase alert after a verified upward update', async () => {
    const deps = { ...dependencies([listing({
      price: new Prisma.Decimal(7_000),
      supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(4_000) },
    })]), targetMarginPercentage: 40 };

    await syncMarketplacePrices(deps);

    expect(deps.priceClient.updatePrice).toHaveBeenCalledWith('MLA123', 8_333.34);
    expect(deps.logger).toHaveBeenCalledWith('WARN', 'SUPPLIER_PRICE_INCREASE', expect.any(String), expect.objectContaining({
      listingId: 'listing-1', currentPrice: 7_000, proposedPrice: 8_333.34,
    }));
  });

  it('blocks an anomalous change, preserves the old value and generates a PRICE_ANOMALY alert', async () => {
    const deps = { ...dependencies([listing()]), maximumPriceChangePercentage: 10 };

    const result = await syncMarketplacePrices(deps);

    expect(deps.priceClient.updatePrice).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(deps.logger).toHaveBeenCalledWith('WARN', 'PRICE_ANOMALY', expect.any(String), expect.objectContaining({
      currentPrice: 10_000, proposedPrice: 8_000, changePercentage: 20, reasons: ['CHANGE_PERCENTAGE'],
    }));
    expect(result.anomalies).toBe(1);
  });

  it('blocks a recommended price outside the configured minimum', async () => {
    const deps = { ...dependencies([listing()]), minimumPrice: 9_000 };
    const result = await syncMarketplacePrices(deps);
    expect(deps.priceClient.updatePrice).not.toHaveBeenCalled();
    expect(result.anomalies).toBe(1);
  });

  it('pauses the listing when a higher supplier cost makes it unprofitable', async () => {
    const deps = dependencies([listing({
      supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(9_000) },
    })]);

    const result = await syncMarketplacePrices(deps);

    expect(deps.priceClient.pause).toHaveBeenCalledWith('MLA123');
    expect(deps.priceClient.updatePrice).not.toHaveBeenCalled();
    expect(deps.updateListing).toHaveBeenCalledWith('listing-1', { status: MarketplaceListingStatus.PAUSED });
    expect(deps.logger).toHaveBeenCalledWith('WARN', 'LOW_MARGIN', expect.any(String), expect.objectContaining({ listingId: 'listing-1' }));
    expect(result.paused).toBe(1);
  });

  it('pauses instead of repricing after a 50 percent supplier cost increase removes the margin', async () => {
    const deps = dependencies([listing({
      supplierProduct: { id: 'product-1', cost: new Prisma.Decimal(7_500) },
    })]);

    const result = await syncMarketplacePrices(deps);

    expect(deps.priceClient.pause).toHaveBeenCalledWith('MLA123');
    expect(deps.priceClient.updatePrice).not.toHaveBeenCalled();
    expect(result).toMatchObject({ paused: 1, updated: 0, failed: 0 });
  });

  it('does not call Mercado Libre when the recommended price is unchanged', async () => {
    const deps = dependencies([listing({ price: new Prisma.Decimal(8_000) })]);

    const result = await syncMarketplacePrices(deps);

    expect(deps.priceClient.updatePrice).not.toHaveBeenCalled();
    expect(deps.updateListing).not.toHaveBeenCalled();
    expect(result.unchanged).toBe(1);
  });

  it('isolates provider failures and continues with the remaining listings', async () => {
    const deps = dependencies([
      listing(),
      listing({ id: 'listing-2', marketplaceItemId: 'MLA456', supplierProduct: { id: 'product-2', cost: new Prisma.Decimal(4_000) } }),
    ]);
    deps.priceClient.updatePrice.mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce(undefined);

    const result = await syncMarketplacePrices(deps);

    expect(deps.priceClient.updatePrice).toHaveBeenNthCalledWith(2, 'MLA456', 6666.67);
    expect(result).toMatchObject({ updated: 1, failed: 1 });
  });
});
