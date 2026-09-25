import { MarketplaceListingStatus, Prisma } from '@prisma/client';
import { dropshippingDryRunEnabled, logDryRunAction } from './dropshipping-dry-run';
import { logSystemEvent } from './logger';
import { MarketplaceStockClient, MercadoLibreStockClient } from './mercado-libre-stock';
import { portalDb } from './portal';
import { ProfitabilityService } from './profitability';

type StockListing = {
  id: string;
  marketplaceItemId: string | null;
  price: Prisma.Decimal | null;
  status: MarketplaceListingStatus;
  supplierProduct: {
    id: string;
    cost: Prisma.Decimal | null;
    stock: number | null;
  };
};

type StockSyncDependencies = {
  findListings?: () => Promise<StockListing[]>;
  stockClient?: MarketplaceStockClient;
  updateListing?: (id: string, status: MarketplaceListingStatus) => Promise<unknown>;
  logger?: typeof logSystemEvent;
  marketplaceFee?: number;
  shippingCost?: number;
  taxes?: number;
  extraCosts?: number;
  minimumProfitPercentage?: number;
  minimumProfitAmount?: number;
  dryRun?: boolean;
  minimumStock?: number;
  pauseWhenNoStock?: boolean;
};

export type StockSyncResult = {
  inspected: number;
  synchronized: number;
  paused: number;
  reactivated: number;
  skippedUnprofitable: number;
  failed: number;
  simulated: number;
};

function configNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
  return value;
}

function isProfitable(listing: StockListing, dependencies: StockSyncDependencies) {
  if (listing.price == null || listing.supplierProduct.cost == null) return false;
  try {
    return new ProfitabilityService({
      minimumProfitPercentage: dependencies.minimumProfitPercentage
        ?? configNumber('MINIMUM_PROFIT_PERCENTAGE', 20),
      minimumProfitAmount: dependencies.minimumProfitAmount
        ?? configNumber('MINIMUM_PROFIT_AMOUNT', 0),
    }).calculate({
      supplierCost: Number(listing.supplierProduct.cost),
      marketplacePrice: Number(listing.price),
      marketplaceFee: dependencies.marketplaceFee ?? configNumber('MARKETPLACE_FEE', 0),
      shippingCost: dependencies.shippingCost ?? configNumber('SHIPPING_COST', 0),
      taxes: dependencies.taxes ?? configNumber('TAXES', 0),
      extraCosts: dependencies.extraCosts ?? configNumber('EXTRA_COSTS', 0),
    }).meetsMinimumProfitability;
  } catch {
    return false;
  }
}

export async function syncMarketplaceStock(dependencies: StockSyncDependencies = {}): Promise<StockSyncResult> {
  const findListings = dependencies.findListings || (() => portalDb.marketplaceListing.findMany({
    where: {
      marketplace: 'MERCADO_LIBRE',
      marketplaceItemId: { not: null },
      status: { in: [MarketplaceListingStatus.ACTIVE, MarketplaceListingStatus.PAUSED] },
    },
    select: {
      id: true,
      marketplaceItemId: true,
      price: true,
      status: true,
      supplierProduct: { select: { id: true, cost: true, stock: true } },
    },
  }));
  const stockClient = dependencies.stockClient || new MercadoLibreStockClient();
  const updateListing = dependencies.updateListing || ((id, status) => portalDb.marketplaceListing.update({
    where: { id },
    data: { status, lastSyncAt: new Date() },
  }));
  const logger = dependencies.logger || logSystemEvent;
  const dryRun = dependencies.dryRun ?? dropshippingDryRunEnabled();
  const listings = await findListings();
  const result: StockSyncResult = {
    inspected: listings.length,
    synchronized: 0,
    paused: 0,
    reactivated: 0,
    skippedUnprofitable: 0,
    failed: 0,
    simulated: 0,
  };

  for (const listing of listings) {
    const itemId = listing.marketplaceItemId;
    if (!itemId) continue;
    const rawSupplierStock = Math.max(0, listing.supplierProduct.stock ?? 0);
    const minimumStock = dependencies.minimumStock ?? 1;
    const supplierStock = rawSupplierStock < minimumStock ? 0 : rawSupplierStock;

    try {
      if (supplierStock > 0 && !isProfitable(listing, dependencies)) {
        result.skippedUnprofitable += 1;
        if (listing.status !== MarketplaceListingStatus.PAUSED) {
          if (dryRun) {
            result.simulated += 1;
            await logDryRunAction('marketplace_stock_update', {
              listingId: listing.id,
              supplierProductId: listing.supplierProduct.id,
              availableQuantity: 0,
              nextStatus: MarketplaceListingStatus.PAUSED,
              reason: 'LOW_MARGIN',
            }, logger);
            continue;
          }
          await stockClient.updateAvailableQuantity(itemId, 0);
          await updateListing(listing.id, MarketplaceListingStatus.PAUSED);
          result.paused += 1;
          result.synchronized += 1;
        }
        await logger('WARN', 'LOW_MARGIN', 'Marketplace listing remains paused because it is not profitable', {
          listingId: listing.id,
          supplierProductId: listing.supplierProduct.id,
          supplierStock,
        });
        continue;
      }

      const nextStatus = supplierStock === 0
        ? MarketplaceListingStatus.PAUSED
        : MarketplaceListingStatus.ACTIVE;
      if (supplierStock === 0 && dependencies.pauseWhenNoStock === false) {
        continue;
      }
      if (dryRun) {
        result.simulated += 1;
        await logDryRunAction('marketplace_stock_update', {
          listingId: listing.id,
          supplierProductId: listing.supplierProduct.id,
          availableQuantity: supplierStock,
          nextStatus,
        }, logger);
        continue;
      }
      await stockClient.updateAvailableQuantity(itemId, supplierStock);
      await updateListing(listing.id, nextStatus);
      result.synchronized += 1;
      if (supplierStock === 0 && listing.status !== MarketplaceListingStatus.PAUSED) result.paused += 1;
      if (supplierStock > 0 && listing.status === MarketplaceListingStatus.PAUSED) result.reactivated += 1;
      if (supplierStock === 0 && listing.status !== MarketplaceListingStatus.PAUSED) {
        await logger('WARN', 'SUPPLIER_OUT_OF_STOCK', 'Marketplace listing paused because the supplier is out of stock', {
          listingId: listing.id,
          supplierProductId: listing.supplierProduct.id,
          supplierStock,
        });
      }
    } catch (error) {
      result.failed += 1;
      await logger('ERROR', 'marketplace_stock_sync', 'Marketplace stock synchronization failed', {
        listingId: listing.id,
        supplierProductId: listing.supplierProduct.id,
        supplierStock,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  await logger('INFO', 'marketplace_stock_sync', 'Marketplace stock synchronization completed', result);
  return result;
}
