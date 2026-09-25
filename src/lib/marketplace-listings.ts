import { MarketplaceListingStatus, Prisma } from '@prisma/client';
import { portalDb } from './portal';

function identifier(name: string, value: string) {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(normalized)) throw new Error(`Invalid ${name}`);
  return normalized;
}

function marketplaceName(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(normalized)) throw new Error('Invalid marketplace');
  return normalized;
}

function price(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid listing price');
  return new Prisma.Decimal(value);
}

export async function linkMarketplaceListing(input: {
  supplierProductId: string;
  marketplace: string;
  marketplaceAccountId: string;
  price?: number | null;
}) {
  const supplierProductId = identifier('supplier product id', input.supplierProductId);
  const marketplace = marketplaceName(input.marketplace);
  const marketplaceAccountId = identifier('marketplace account id', input.marketplaceAccountId);
  return portalDb.marketplaceListing.upsert({
    where: {
      supplierProductId_marketplace_marketplaceAccountId: {
        supplierProductId,
        marketplace,
        marketplaceAccountId,
      },
    },
    create: {
      supplierProductId,
      marketplace,
      marketplaceAccountId,
      price: price(input.price),
    },
    update: { price: price(input.price) },
  });
}

export async function synchronizeMarketplaceListing(input: {
  listingId: string;
  marketplaceItemId: string;
  status: MarketplaceListingStatus;
  price?: number | null;
  syncedAt?: Date;
}) {
  const listingId = identifier('listing id', input.listingId);
  const marketplaceItemId = identifier('marketplace item id', input.marketplaceItemId);
  const syncedAt = input.syncedAt || new Date();
  return portalDb.marketplaceListing.update({
    where: { id: listingId },
    data: {
      marketplaceItemId,
      status: input.status,
      ...(input.price === undefined ? {} : { price: price(input.price) }),
      lastSyncAt: syncedAt,
      publishedAt: input.status === MarketplaceListingStatus.ACTIVE ? syncedAt : undefined,
    },
  });
}
