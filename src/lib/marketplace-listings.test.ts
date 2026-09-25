import { MarketplaceListingStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn() }));
vi.mock('./portal', () => ({ portalDb: { marketplaceListing: db } }));

import { linkMarketplaceListing, synchronizeMarketplaceListing } from './marketplace-listings';

describe('marketplace listings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links one supplier product idempotently to a marketplace account', async () => {
    db.upsert.mockResolvedValue({ id: 'listing-1' });
    await linkMarketplaceListing({
      supplierProductId: 'supplier-product-1',
      marketplace: 'mercado_libre',
      marketplaceAccountId: 'account-1',
      price: 12_500,
    });
    expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        supplierProductId_marketplace_marketplaceAccountId: {
          supplierProductId: 'supplier-product-1',
          marketplace: 'MERCADO_LIBRE',
          marketplaceAccountId: 'account-1',
        },
      },
      create: expect.objectContaining({ supplierProductId: 'supplier-product-1', marketplace: 'MERCADO_LIBRE' }),
    }));
  });

  it('stores the external id and synchronization state', async () => {
    const syncedAt = new Date('2026-09-24T19:35:00Z');
    db.update.mockResolvedValue({ id: 'listing-1' });
    await synchronizeMarketplaceListing({
      listingId: 'listing-1',
      marketplaceItemId: 'MLA123456',
      status: MarketplaceListingStatus.ACTIVE,
      price: 15_000,
      syncedAt,
    });
    expect(db.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: expect.objectContaining({
        marketplaceItemId: 'MLA123456',
        status: MarketplaceListingStatus.ACTIVE,
        lastSyncAt: syncedAt,
        publishedAt: syncedAt,
      }),
    });
  });

  it('rejects malformed ids and negative prices before persistence', async () => {
    await expect(linkMarketplaceListing({ supplierProductId: '../bad', marketplace: 'ML', marketplaceAccountId: 'account' })).rejects.toThrow('supplier product');
    await expect(linkMarketplaceListing({ supplierProductId: 'product', marketplace: 'ML', marketplaceAccountId: 'account', price: -1 })).rejects.toThrow('price');
    expect(db.upsert).not.toHaveBeenCalled();
  });
});
