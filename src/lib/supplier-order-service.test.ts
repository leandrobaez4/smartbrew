import { OrderStatus, Prisma, SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnector, SupplierConnectorFactory } from './suppliers/connectors';
import { automaticSupplierOrderingEnabled, createSupplierOrder } from './supplier-order-service';

const supplier = {
  id: 'supplier-1', name: 'Supplier', slug: 'supplier', type: null, website: null, apiUrl: null,
  apiKeyEncrypted: null, apiSecretEncrypted: null, usernameEncrypted: null, passwordEncrypted: null,
  integrationType: SupplierIntegrationType.API, status: SupplierStatus.ACTIVE, lastSyncAt: null,
  createdAt: new Date(0), updatedAt: new Date(0),
};
const product = {
  id: 'product-1', supplierId: 'supplier-1', externalId: 'external-1', sku: null, ean: null,
  title: 'Product', description: null, brand: null, category: null, cost: new Prisma.Decimal(100),
  currency: 'ARS', stock: 5, images: [], attributes: null, rawData: {}, active: true,
  lastSyncAt: new Date(0), createdAt: new Date(0), updatedAt: new Date(0),
};
const order = {
  id: 'order-1', marketplaceOrderId: 'ML-ORDER-1', quantity: 2,
  shippingData: { receiver_address: { street_name: 'Calle', street_number: 123, ignored: { secret: true } } },
  status: OrderStatus.PENDING, supplierOrderId: null, supplier, supplierProduct: product,
};

function connector(): SupplierConnector {
  return {
    getProducts: vi.fn(), getProduct: vi.fn(), getStock: vi.fn(), getPrice: vi.fn(), getOrderStatus: vi.fn(),
    createOrder: vi.fn().mockResolvedValue({ externalOrderId: 'SUP-123', status: 'created' }),
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  const raw = connector();
  return {
    automatic: true,
    findOrder: vi.fn().mockResolvedValue(order),
    claimOrder: vi.fn().mockResolvedValue(true),
    saveSuccess: vi.fn().mockResolvedValue(undefined),
    saveFailure: vi.fn().mockResolvedValue(undefined),
    factory: new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register('api', () => raw),
    logger: vi.fn().mockResolvedValue(undefined),
    raw,
    ...overrides,
  };
}

describe('SupplierOrderService', () => {
  it.each([undefined, '', 'OFF', 'false', '0'])('keeps automatic purchases disabled for %s', (value) => {
    expect(automaticSupplierOrderingEnabled(value)).toBe(false);
  });

  it('creates a supplier order and stores its external response', async () => {
    const deps = dependencies();
    const result = await createSupplierOrder('order-1', deps);

    expect(deps.raw.createOrder).toHaveBeenCalledWith({
      reference: 'ML-ORDER-1',
      items: [{ externalId: 'external-1', quantity: 2 }],
      shippingAddress: { street_name: 'Calle', street_number: '123' },
    });
    expect(deps.saveSuccess).toHaveBeenCalledWith(
      'order-1', 'SUP-123', { externalOrderId: 'SUP-123', status: 'created' }, OrderStatus.SUPPLIER_PENDING,
    );
    expect(result).toEqual({ status: 'created', externalOrderId: 'SUP-123' });
  });

  it('never calls the connector when automatic ordering is disabled', async () => {
    const deps = dependencies({ automatic: false });
    await expect(createSupplierOrder('order-1', deps)).resolves.toEqual({ status: 'disabled' });
    expect(deps.findOrder).not.toHaveBeenCalled();
    expect(deps.raw.createOrder).not.toHaveBeenCalled();
  });

  it('simulates a supplier purchase without claiming or calling the connector in dry run', async () => {
    const deps = dependencies({ dryRun: true });
    await expect(createSupplierOrder('order-1', deps)).resolves.toEqual({ status: 'simulated' });
    expect(deps.claimOrder).not.toHaveBeenCalled();
    expect(deps.saveSuccess).not.toHaveBeenCalled();
    expect(deps.raw.createOrder).not.toHaveBeenCalled();
    expect(deps.logger).toHaveBeenCalledWith(
      'INFO', 'dropshipping_dry_run', 'Dry run: supplier_order_create',
      expect.objectContaining({ operation: 'supplier_order_create', orderId: 'order-1', quantity: 2 }),
    );
  });

  it('returns the existing supplier order without purchasing twice', async () => {
    const deps = dependencies({ findOrder: vi.fn().mockResolvedValue({ ...order, supplierOrderId: 'SUP-OLD' }) });
    await expect(createSupplierOrder('order-1', deps)).resolves.toEqual({ status: 'duplicate', externalOrderId: 'SUP-OLD' });
    expect(deps.claimOrder).not.toHaveBeenCalled();
    expect(deps.raw.createOrder).not.toHaveBeenCalled();
  });

  it('uses an atomic claim to prevent concurrent purchases', async () => {
    const deps = dependencies({ claimOrder: vi.fn().mockResolvedValue(false) });
    await expect(createSupplierOrder('order-1', deps)).resolves.toEqual({ status: 'in_progress' });
    expect(deps.raw.createOrder).not.toHaveBeenCalled();
  });

  it('records connector failures without storing secrets', async () => {
    const raw = connector();
    vi.mocked(raw.createOrder).mockRejectedValue(new Error('remote timeout'));
    const deps = dependencies({
      factory: new SupplierConnectorFactory({ info: vi.fn(), error: vi.fn() }).register('api', () => raw),
      raw,
    });
    await expect(createSupplierOrder('order-1', deps)).rejects.toThrow();
    expect(deps.saveFailure).toHaveBeenCalledWith('order-1');
    expect(deps.logger).toHaveBeenCalledWith('ERROR', 'supplier_order', expect.any(String), expect.objectContaining({
      orderId: 'order-1', supplierId: 'supplier-1',
    }));
  });
});
