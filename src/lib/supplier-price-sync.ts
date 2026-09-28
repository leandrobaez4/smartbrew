import { MarketplaceListingStatus, Prisma } from '@prisma/client';
import { dropshippingDryRunEnabled, logDryRunAction } from './dropshipping-dry-run';
import { logSystemEvent } from './logger';
import { MarketplacePriceClient, MercadoLibrePriceClient } from './mercado-libre-price';
import { portalDb } from './portal';
import { PricingService } from './pricing';
import { ProfitabilityService } from './profitability';
import { PriceSafetyRules } from './price-safety';

type PriceListing = {
  id: string;
  marketplaceItemId: string | null;
  price: Prisma.Decimal | null;
  status: MarketplaceListingStatus;
  supplierProduct: {
    id: string;
    cost: Prisma.Decimal | null;
    pricing?: {
      productSearchCostArs: Prisma.Decimal;
      shippingCostArs: Prisma.Decimal;
      marketplaceFeePercentage: Prisma.Decimal;
      marketplaceFixedFeeArs: Prisma.Decimal;
      targetMarginPercentage: Prisma.Decimal;
    } | null;
  };
};

type PriceSyncDependencies = {
  findListings?: () => Promise<PriceListing[]>;
  priceClient?: MarketplacePriceClient;
  updateListing?: (id: string, data: { price?: number; status?: MarketplaceListingStatus }) => Promise<unknown>;
  logger?: typeof logSystemEvent;
  marketplaceFee?: number;
  shippingCost?: number;
  taxes?: number;
  extraCosts?: number;
  targetMarginPercentage?: number;
  minimumProfitPercentage?: number;
  minimumProfitAmount?: number;
  maximumPriceChangePercentage?: number;
  minimumPrice?: number;
  maximumPrice?: number;
  dryRun?: boolean;
};

export type PriceSyncResult = {
  inspected: number;
  updated: number;
  unchanged: number;
  paused: number;
  anomalies: number;
  failed: number;
  simulated: number;
};

function configNumber(name: string, fallback: number) {
  const raw = process.env[name];
  const value = raw == null || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
  return value;
}

function costs(dependencies: PriceSyncDependencies, listing: PriceListing) {
  const pricing = listing.supplierProduct.pricing;
  if (pricing) return {
    marketplaceFee: Number(pricing.marketplaceFixedFeeArs),
    marketplaceFeePercentage: Number(pricing.marketplaceFeePercentage),
    shippingCost: Number(pricing.shippingCostArs),
    taxes: 0,
    extraCosts: Number(pricing.productSearchCostArs),
    targetMarginPercentage: Number(pricing.targetMarginPercentage),
  };
  return {
    marketplaceFee: dependencies.marketplaceFee ?? configNumber('MARKETPLACE_FEE', 0),
    marketplaceFeePercentage: 0,
    shippingCost: dependencies.shippingCost ?? configNumber('SHIPPING_COST', 0),
    taxes: dependencies.taxes ?? configNumber('TAXES', 0),
    extraCosts: dependencies.extraCosts ?? configNumber('EXTRA_COSTS', 0),
    targetMarginPercentage: dependencies.targetMarginPercentage,
  };
}

export async function syncMarketplacePrices(dependencies: PriceSyncDependencies = {}): Promise<PriceSyncResult> {
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
      supplierProduct: { select: { id: true, cost: true, pricing: { select: {
        productSearchCostArs: true,
        shippingCostArs: true,
        marketplaceFeePercentage: true,
        marketplaceFixedFeeArs: true,
        targetMarginPercentage: true,
      } } } },
    },
  }));
  const priceClient = dependencies.priceClient || new MercadoLibrePriceClient();
  const updateListing = dependencies.updateListing || ((id, data) => portalDb.marketplaceListing.update({
    where: { id },
    data: { ...data, lastSyncAt: new Date() },
  }));
  const logger = dependencies.logger || logSystemEvent;
  const dryRun = dependencies.dryRun ?? dropshippingDryRunEnabled();
  const listings = await findListings();
  const safetyRules = new PriceSafetyRules({
    maximumPriceChangePercentage: dependencies.maximumPriceChangePercentage
      ?? configNumber('MAXIMUM_PRICE_CHANGE_PERCENTAGE', 50),
    minimumPrice: dependencies.minimumPrice ?? configNumber('MINIMUM_PRICE', 1),
    maximumPrice: dependencies.maximumPrice ?? configNumber('MAXIMUM_PRICE', 1_000_000_000),
  });
  const result: PriceSyncResult = {
    inspected: listings.length, updated: 0, unchanged: 0, paused: 0, anomalies: 0, failed: 0, simulated: 0,
  };

  for (const listing of listings) {
    const itemId = listing.marketplaceItemId;
    const supplierCost = listing.supplierProduct.cost == null ? Number.NaN : Number(listing.supplierProduct.cost);
    const currentPrice = listing.price == null ? Number.NaN : Number(listing.price);
    try {
      if (!itemId || !Number.isFinite(supplierCost) || !Number.isFinite(currentPrice)) {
        throw new Error('La publicación no tiene costo, precio o ID válido.');
      }
      const operatingCosts = costs(dependencies, listing);
      const minimumProfitPercentage = dependencies.minimumProfitPercentage
        ?? configNumber('MINIMUM_PROFIT_PERCENTAGE', 20);
      const minimumProfitAmount = dependencies.minimumProfitAmount
        ?? configNumber('MINIMUM_PROFIT_AMOUNT', 0);
      const profitability = new ProfitabilityService({ minimumProfitPercentage, minimumProfitAmount }).calculate({
        supplierCost,
        marketplacePrice: currentPrice,
        marketplaceFee: operatingCosts.marketplaceFee + currentPrice * operatingCosts.marketplaceFeePercentage / 100,
        shippingCost: operatingCosts.shippingCost,
        taxes: operatingCosts.taxes,
        extraCosts: operatingCosts.extraCosts,
      });

      const recommended = new PricingService({
        minimumMarginPercentage: minimumProfitPercentage,
        minimumProfitAmount,
      }).calculate({
        supplierCost,
        marketplaceFee: operatingCosts.marketplaceFee,
        marketplaceFeePercentage: operatingCosts.marketplaceFeePercentage,
        shippingCost: operatingCosts.shippingCost,
        taxes: operatingCosts.taxes,
        extraCosts: operatingCosts.extraCosts,
        targetMarginPercentage: operatingCosts.targetMarginPercentage
          ?? configNumber('TARGET_MARGIN_PERCENTAGE', minimumProfitPercentage),
      });
      if (recommended.recommendedPrice === currentPrice) {
        if (profitability.meetsMinimumProfitability) result.unchanged += 1;
        continue;
      }
      const safety = safetyRules.evaluate(currentPrice, recommended.recommendedPrice);
      if (!safety.safe) {
        result.anomalies += 1;
        await logger('WARN', 'PRICE_ANOMALY', 'Marketplace price change blocked by safety rules', {
          listingId: listing.id,
          supplierProductId: listing.supplierProduct.id,
          currentPrice,
          proposedPrice: recommended.recommendedPrice,
          changePercentage: safety.changePercentage,
          reasons: safety.reasons,
        });
        if (!profitability.meetsMinimumProfitability) {
          if (dryRun) {
            result.simulated += 1;
            await logDryRunAction('marketplace_price_pause', {
              listingId: listing.id,
              supplierProductId: listing.supplierProduct.id,
              supplierCost,
              currentPrice,
              marginPercentage: profitability.marginPercentage,
            }, logger);
            continue;
          }
          await priceClient.pause(itemId);
          await updateListing(listing.id, { status: MarketplaceListingStatus.PAUSED });
          result.paused += 1;
          await logger('WARN', 'LOW_MARGIN', 'Marketplace listing paused because no safe profitable price was available', {
            listingId: listing.id,
            supplierProductId: listing.supplierProduct.id,
            supplierCost,
            currentPrice,
            proposedPrice: recommended.recommendedPrice,
            marginPercentage: profitability.marginPercentage,
          });
        }
        continue;
      }
      if (dryRun) {
        result.simulated += 1;
        await logDryRunAction('marketplace_price_update', {
          listingId: listing.id,
          supplierProductId: listing.supplierProduct.id,
          currentPrice,
          proposedPrice: recommended.recommendedPrice,
        }, logger);
        continue;
      }
      await priceClient.updatePrice(itemId, recommended.recommendedPrice);
      await updateListing(listing.id, { price: recommended.recommendedPrice });
      result.updated += 1;
      if (recommended.recommendedPrice > currentPrice) {
        await logger('WARN', 'SUPPLIER_PRICE_INCREASE', 'Marketplace price increased after supplier cost recalculation', {
          listingId: listing.id,
          supplierProductId: listing.supplierProduct.id,
          supplierCost,
          currentPrice,
          proposedPrice: recommended.recommendedPrice,
        });
      }
    } catch (error) {
      result.failed += 1;
      await logger('ERROR', 'marketplace_price_sync', 'Marketplace price synchronization failed', {
        listingId: listing.id,
        supplierProductId: listing.supplierProduct.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  await logger('INFO', 'marketplace_price_sync', 'Marketplace price synchronization completed', result);
  return result;
}
