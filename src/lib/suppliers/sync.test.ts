import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnector, SupplierConnectorFactory } from './connectors';
import { registerMockSupplierConnector } from './mock';
import { supplierSyncIntervalMs, syncSuppliers } from './sync';

function supplier(id: string) {
  return {
    id,
    name: id,
    slug: id,
    type: null,
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

function connector(getProducts: SupplierConnector['getProducts']): SupplierConnector {
  return {
    getProducts,
    getProduct: vi.fn(),
    getStock: vi.fn(),
    getPrice: vi.fn(),
    createOrder: vi.fn(),
    getOrderStatus: vi.fn(),
  };
}

describe('supplier catalog synchronization', () => {
  it('continues with remaining suppliers and records every result', async () => {
    const integrationLogger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    let calls = 0;
    const factory = new SupplierConnectorFactory(integrationLogger).register('api', () => connector(async () => {
      calls += 1;
      if (calls === 1) throw new Error('supplier unavailable');
      return [{ externalId: 'product-1', title: 'Product', rawData: { id: 1 } }];
    }));
    const importProducts = vi.fn().mockResolvedValue({ imported: 1, syncedAt: new Date(0) });
    const logger = vi.fn().mockResolvedValue(undefined);
    const store = { supplier: { findMany: vi.fn().mockResolvedValue([supplier('first'), supplier('second')]) } };

    const result = await syncSuppliers({ store: store as never, factory, logger, importProducts });

    expect(result).toMatchObject({ processed: 2, succeeded: 1, failed: 1 });
    expect(importProducts).toHaveBeenCalledOnce();
    expect(importProducts).toHaveBeenCalledWith('second', expect.any(Array));
    expect(logger).toHaveBeenCalledWith('ERROR', 'supplier_sync', 'Supplier catalog synchronization failed', expect.objectContaining({ supplierId: 'first' }));
    expect(logger).toHaveBeenCalledWith('INFO', 'supplier_sync', 'Supplier catalog synchronized', expect.objectContaining({ supplierId: 'second' }));
  });

  it('filters a manual run to one supplier', async () => {
    const store = { supplier: { findMany: vi.fn().mockResolvedValue([]) } };
    await syncSuppliers({ supplierId: 'supplier-1', store: store as never, logger: vi.fn().mockResolvedValue(undefined) });
    expect(store.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', id: 'supplier-1' },
    }));
  });

  it('uses a safe configurable interval', () => {
    expect(supplierSyncIntervalMs(undefined)).toBe(15 * 60_000);
    expect(supplierSyncIntervalMs('5')).toBe(5 * 60_000);
    expect(() => supplierSyncIntervalMs('0')).toThrow('SUPPLIER_SYNC_INTERVAL');
    expect(() => supplierSyncIntervalMs('1.5')).toThrow('SUPPLIER_SYNC_INTERVAL');
  });

  it.each([
    ['supplier API error', { failures: { getProducts: 'mock API unavailable' } }],
    ['supplier timeout', { timeouts: { getProducts: 1 } }],
  ])('records an isolated %s from the configurable mock connector', async (_label, scenario) => {
    const integrationLogger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    const factory = registerMockSupplierConnector(new SupplierConnectorFactory(integrationLogger), scenario);
    const mockSupplier = { ...supplier('mock-supplier'), type: 'mock' };
    const store = { supplier: { findMany: vi.fn().mockResolvedValue([mockSupplier]) } };
    const importProducts = vi.fn().mockResolvedValue({ imported: 1, syncedAt: new Date(0) });
    const logger = vi.fn().mockResolvedValue(undefined);

    const result = await syncSuppliers({ store: store as never, factory, logger, importProducts });

    expect(result).toMatchObject({ processed: 1, succeeded: 0, failed: 1 });
    expect(importProducts).not.toHaveBeenCalled();
    expect(logger).toHaveBeenCalledWith(
      'ERROR', 'supplier_sync', 'Supplier catalog synchronization failed',
      expect.objectContaining({ supplierId: 'mock-supplier' }),
    );
  });
});
