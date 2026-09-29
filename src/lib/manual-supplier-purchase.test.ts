import { OrderStatus, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { resolveManualSupplierPurchase } from './manual-supplier-purchase';

const order = {
  id: 'order-1', salePrice: new Prisma.Decimal(30_000), supplierCost: new Prisma.Decimal(10_000),
  marketplaceFee: new Prisma.Decimal(3_000), shippingCost: new Prisma.Decimal(1_000), taxes: new Prisma.Decimal(500), quantity: 2,
  supplier: { id: 'unidrop-1', type: 'unidrop-snapshot-v1' }, supplierProduct: { id: 'product-1', sku: 'SKU-1' },
};

function dependencies(record = order) {
  return {
    findOrder: vi.fn().mockResolvedValue(record),
    updateOrder: vi.fn().mockResolvedValue({}),
    logger: vi.fn().mockResolvedValue(undefined),
    now: new Date('2026-09-29T20:00:00.000Z'),
  };
}

describe('manual supplier purchase', () => {
  it('records the real total cost, reference and actual profitability without calling a connector', async () => {
    const deps = dependencies();
    await expect(resolveManualSupplierPurchase('order-1', { action: 'complete', reference: 'UNI-123', actualCost: 21_000 }, deps)).resolves.toEqual({ status: 'completed', actualProfit: 4_500 });
    expect(deps.updateOrder).toHaveBeenCalledWith('order-1', expect.objectContaining({
      manualPurchaseReference: 'UNI-123', status: OrderStatus.SUPPLIER_PAID, financialsEstimated: false,
      actualSupplierCost: expect.any(Prisma.Decimal), profit: expect.any(Prisma.Decimal),
    }));
    expect(deps.logger).toHaveBeenCalledWith('INFO', 'manual_supplier_purchase', expect.any(String), expect.objectContaining({ estimatedCost: 20_000, actualCost: 21_000 }));
  });

  it('marks a manual purchase error with traceability', async () => {
    const deps = dependencies();
    await expect(resolveManualSupplierPurchase('order-1', { action: 'error', error: 'Sin stock al confirmar' }, deps)).resolves.toEqual({ status: 'error' });
    expect(deps.updateOrder).toHaveBeenCalledWith('order-1', expect.objectContaining({ status: OrderStatus.ERROR, manualPurchaseError: 'Sin stock al confirmar' }));
  });

  it('rejects non-Unidrop orders and invalid costs', async () => {
    await expect(resolveManualSupplierPurchase('order-1', { action: 'complete', reference: 'x', actualCost: 1 }, dependencies({ ...order, supplier: { id: 'elit', type: 'elit-api-v1' } }))).rejects.toThrow('Unidrop');
    await expect(resolveManualSupplierPurchase('order-1', { action: 'complete', reference: 'x', actualCost: -1 }, dependencies())).rejects.toThrow('costo real');
  });
});
