import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnector, SupplierConnectorFactory } from './connectors';
import { monitorPublishedSupplierProducts } from './monitor';

const syncedAt = new Date('2026-09-28T18:00:00.000Z');

function supplier(id: string) {
  return {
    id,
    name: id,
    slug: id,
    type: 'targeted',
    website: null,
    apiUrl: null,
    apiKeyEncrypted: null,
    apiSecretEncrypted: null,
    usernameEncrypted: null,
    passwordEncrypted: null,
    integrationType: SupplierIntegrationType.API,
    status: SupplierStatus.ACTIVE,
    lastSyncAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function listedProduct(id: string, supplierId = 'supplier-1') {
  return {
    supplierProduct: {
      id,
      supplierId,
      externalId: id.replace('product-', ''),
      sku: null,
      ean: null,
      title: `Product ${id}`,
      description: null,
      brand: null,
      category: null,
      cost: null,
      currency: 'ARS',
      stock: null,
      images: [],
      attributes: null,
      rawData: {},
      supplier: supplier(supplierId),
    },
  };
}

function connector(getProduct: SupplierConnector['getProduct']): SupplierConnector {
  return {
    getProducts: vi.fn(),
    getProduct,
    getStock: vi.fn(),
    getPrice: vi.fn(),
    createOrder: vi.fn(),
    getOrderStatus: vi.fn(),
  };
}

describe('published supplier product monitoring', () => {
  it('queries only active or paused Mercado Libre listings and deduplicates supplier products', async () => {
    const getProduct = vi.fn().mockResolvedValue({
      externalId: '1', title: 'Updated product', cost: 120, stock: 4, currency: 'ARS', rawData: { id: 1 },
    });
    const factory = new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register({
      key: 'targeted', capabilities: ['product'], builder: () => connector(getProduct),
    });
    const store = { marketplaceListing: { findMany: vi.fn().mockResolvedValue([listedProduct('product-1'), listedProduct('product-1')]) } };
    const importProducts = vi.fn().mockResolvedValue({ imported: 1, historyCreated: 1, syncedAt });
    const logger = vi.fn().mockResolvedValue(undefined);

    const result = await monitorPublishedSupplierProducts({ store: store as never, factory, importProducts, logger, syncedAt });

    expect(store.marketplaceListing.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        marketplace: 'MERCADO_LIBRE',
        status: { in: ['ACTIVE', 'PAUSED'] },
        supplierProduct: { supplier: { status: 'ACTIVE' } },
      },
    }));
    expect(getProduct).toHaveBeenCalledOnce();
    expect(getProduct).toHaveBeenCalledWith('1');
    expect(importProducts).toHaveBeenCalledWith('supplier-1', [expect.objectContaining({ externalId: '1', cost: 120, stock: 4 })], syncedAt);
    expect(result).toMatchObject({ inspected: 1, succeeded: 1, failed: 0 });
  });

  it('isolates provider failures and continues monitoring other published products', async () => {
    const getProduct = vi.fn().mockImplementation(async (externalId: string) => {
      if (externalId === '1') throw new Error('provider unavailable');
      return { externalId, title: 'Available', cost: 50, stock: 2, currency: 'ARS', rawData: { id: externalId } };
    });
    const factory = new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register({
      key: 'targeted', capabilities: ['product'], builder: () => connector(getProduct),
    });
    const store = { marketplaceListing: { findMany: vi.fn().mockResolvedValue([listedProduct('product-1'), listedProduct('product-2')]) } };
    const importProducts = vi.fn().mockResolvedValue({ imported: 1, historyCreated: 0, syncedAt });
    const logger = vi.fn().mockResolvedValue(undefined);

    const result = await monitorPublishedSupplierProducts({ store: store as never, factory, importProducts, logger, syncedAt });

    expect(result).toMatchObject({ inspected: 2, succeeded: 1, failed: 1 });
    expect(importProducts).toHaveBeenCalledOnce();
    expect(logger).toHaveBeenCalledWith('ERROR', 'supplier_product_monitor', 'Published supplier product synchronization failed', expect.objectContaining({
      supplierProductId: 'product-1',
      externalId: '1',
    }));
  });
});
