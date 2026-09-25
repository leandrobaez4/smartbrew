import { OrderStatus, SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnector, SupplierConnectorFactory } from './suppliers/connectors';
import { normalizeSupplierOrderStatus, syncSupplierOrderStatuses } from './supplier-order-status-sync';

const supplier = {
  id: 'supplier-1', name: 'Supplier', slug: 'supplier', type: null, website: null, apiUrl: null,
  apiKeyEncrypted: null, apiSecretEncrypted: null, usernameEncrypted: null, passwordEncrypted: null,
  integrationType: SupplierIntegrationType.API, status: SupplierStatus.ACTIVE, lastSyncAt: null,
  createdAt: new Date(0), updatedAt: new Date(0),
};

function connector(getOrderStatus: SupplierConnector['getOrderStatus']): SupplierConnector {
  return {
    getProducts: vi.fn(), getProduct: vi.fn(), getStock: vi.fn(), getPrice: vi.fn(), createOrder: vi.fn(),
    getOrderStatus,
  };
}

describe('SupplierOrderStatusSync', () => {
  it.each([
    ['pending', OrderStatus.SUPPLIER_PENDING],
    ['processing', OrderStatus.PROCESSING],
    ['ready', OrderStatus.PROCESSING],
    ['shipped', OrderStatus.SHIPPED],
    ['delivered', OrderStatus.DELIVERED],
    ['cancelled', OrderStatus.CANCELLED],
  ])('normalizes %s to %s', (external, internal) => {
    expect(normalizeSupplierOrderStatus(external)).toBe(internal);
  });

  it('queries the supplier and updates the internal order', async () => {
    const getOrderStatus = vi.fn().mockResolvedValue({ externalOrderId: 'SUP-1', status: 'shipped' });
    const updateOrder = vi.fn().mockResolvedValue(undefined);
    const logger = vi.fn().mockResolvedValue(undefined);
    const result = await syncSupplierOrderStatuses({
      findOrders: vi.fn().mockResolvedValue([{ id: 'order-1', supplierOrderId: 'SUP-1', status: OrderStatus.PROCESSING, supplier }]),
      updateOrder,
      factory: new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register('api', () => connector(getOrderStatus)),
      logger,
    });

    expect(getOrderStatus).toHaveBeenCalledWith('SUP-1');
    expect(updateOrder).toHaveBeenCalledWith('order-1', OrderStatus.SHIPPED);
    expect(result).toEqual({ inspected: 1, updated: 1, unchanged: 0, failed: 0 });
  });

  it('does not write when the normalized status is unchanged', async () => {
    const updateOrder = vi.fn();
    const result = await syncSupplierOrderStatuses({
      findOrders: vi.fn().mockResolvedValue([{ id: 'order-1', supplierOrderId: 'SUP-1', status: OrderStatus.SHIPPED, supplier }]),
      updateOrder,
      factory: new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register('api', () => connector(
        vi.fn().mockResolvedValue({ externalOrderId: 'SUP-1', status: 'shipped' }),
      )),
      logger: vi.fn(),
    });
    expect(updateOrder).not.toHaveBeenCalled();
    expect(result.unchanged).toBe(1);
  });

  it('isolates invalid responses and continues with remaining orders', async () => {
    const status = vi.fn()
      .mockResolvedValueOnce({ externalOrderId: 'WRONG', status: 'shipped' })
      .mockResolvedValueOnce({ externalOrderId: 'SUP-2', status: 'delivered' });
    const updateOrder = vi.fn().mockResolvedValue(undefined);
    const result = await syncSupplierOrderStatuses({
      findOrders: vi.fn().mockResolvedValue([
        { id: 'order-1', supplierOrderId: 'SUP-1', status: OrderStatus.PROCESSING, supplier },
        { id: 'order-2', supplierOrderId: 'SUP-2', status: OrderStatus.SHIPPED, supplier },
      ]),
      updateOrder,
      factory: new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register('api', () => connector(status)),
      logger: vi.fn(),
    });
    expect(updateOrder).toHaveBeenCalledWith('order-2', OrderStatus.DELIVERED);
    expect(result).toEqual({ inspected: 2, updated: 1, unchanged: 0, failed: 1 });
  });
});
