import { describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  upsert: vi.fn(async (query: unknown) => query),
  findMany: vi.fn().mockResolvedValue([]),
  createHistory: vi.fn(async (query: unknown) => query),
  updateSupplier: vi.fn(async (query: unknown) => query),
}));

vi.mock('../portal', () => ({
  portalDb: {
    $transaction: db.transaction,
    supplierProduct: { upsert: db.upsert, findMany: db.findMany },
    supplierProductHistory: { create: db.createHistory },
    supplier: { update: db.updateSupplier },
  },
}));

import { importSupplierProducts, supplierProductData } from './catalog';

describe('supplier catalog import mapping', () => {
  const syncedAt = new Date('2026-09-24T16:10:00Z');

  it('preserves raw supplier data and the synchronization timestamp', () => {
    const rawData = { id: 123, nested: { source: 'supplier' } };
    const data = supplierProductData({
      externalId: ' ext-1 ',
      sku: ' SKU-1 ',
      title: ' Producto ',
      cost: 125.5,
      currency: 'ARS',
      stock: 7,
      rawData,
    }, syncedAt);

    expect(data.externalId).toBe('ext-1');
    expect(data.sku).toBe('SKU-1');
    expect(data.rawData).toEqual(rawData);
    expect(data.lastSyncAt).toBe(syncedAt);
  });

  it('requires stable external identity and original data', () => {
    expect(() => supplierProductData({ externalId: '', title: 'Producto', rawData: {} }, syncedAt)).toThrow('externalId');
    expect(() => supplierProductData({ externalId: 'ext-1', title: '', rawData: {} }, syncedAt)).toThrow('title');
    expect(() => supplierProductData({ externalId: 'ext-1', title: 'Producto', rawData: undefined }, syncedAt)).toThrow('rawData');
  });

  it('imports idempotently through the supplier/external id unique key', async () => {
    db.transaction.mockClear();
    db.upsert.mockClear();
    db.updateSupplier.mockClear();
    db.findMany.mockResolvedValue([]);
    const product = { externalId: 'ext-1', title: 'Producto', rawData: { id: 'ext-1' } };

    await importSupplierProducts('supplier-1', [product, { ...product, title: 'Producto actualizado' }], syncedAt);
    await importSupplierProducts('supplier-1', [product], syncedAt);

    expect(db.upsert).toHaveBeenCalledTimes(2);
    expect(db.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { supplierId_externalId: { supplierId: 'supplier-1', externalId: 'ext-1' } },
      create: expect.objectContaining({ supplierId: 'supplier-1', externalId: 'ext-1', rawData: product.rawData }),
      update: expect.objectContaining({ externalId: 'ext-1', rawData: product.rawData }),
    }));
    expect(db.transaction).toHaveBeenNthCalledWith(1, expect.any(Array));
    expect(db.transaction.mock.calls[0][0]).toHaveLength(1);
    expect(db.updateSupplier).toHaveBeenLastCalledWith({
      where: { id: 'supplier-1' },
      data: { lastSyncAt: syncedAt },
    });
  });

  it('records price and stock snapshots only when either value changes', async () => {
    db.transaction.mockClear();
    db.upsert.mockClear();
    db.createHistory.mockClear();
    db.findMany.mockResolvedValueOnce([
      { id: 'stored-1', externalId: 'ext-1', cost: 100, stock: 5 },
      { id: 'stored-2', externalId: 'ext-2', cost: 200, stock: 8 },
      { id: 'stored-3', externalId: 'ext-3', cost: 300, stock: 9 },
    ]);

    const result = await importSupplierProducts('supplier-1', [
      { externalId: 'ext-1', title: 'Sin cambios', cost: 100, stock: 5, rawData: {} },
      { externalId: 'ext-2', title: 'Precio nuevo', cost: 225, stock: 8, rawData: {} },
      { externalId: 'ext-3', title: 'Stock nuevo', cost: 300, stock: 4, rawData: {} },
    ], syncedAt);

    expect(result.historyCreated).toBe(2);
    expect(db.createHistory).toHaveBeenCalledTimes(2);
    expect(db.createHistory).toHaveBeenCalledWith({ data: {
      supplierProductId: 'stored-2', cost: expect.anything(), stock: 8, createdAt: syncedAt,
    } });
    expect(db.createHistory).toHaveBeenCalledWith({ data: {
      supplierProductId: 'stored-3', cost: expect.anything(), stock: 4, createdAt: syncedAt,
    } });
    expect(db.transaction.mock.calls[0][0]).toHaveLength(5);
  });

  it('does not create history for a new product or an unchanged import', async () => {
    db.createHistory.mockClear();
    db.findMany.mockResolvedValueOnce([{ id: 'stored-1', externalId: 'ext-1', cost: null, stock: null }]);

    const result = await importSupplierProducts('supplier-1', [
      { externalId: 'ext-1', title: 'Sin cambios', cost: null, stock: null, rawData: {} },
      { externalId: 'new-1', title: 'Nuevo', cost: 50, stock: 1, rawData: {} },
    ], syncedAt);

    expect(result.historyCreated).toBe(0);
    expect(db.createHistory).not.toHaveBeenCalled();
  });
});
