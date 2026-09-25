import { MarketplaceWebhookStatus, OrderStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { parseMercadoLibreNotification, processMercadoLibreNotification } from './mercado-libre-orders';

const notification = {
  _id: 'event-123',
  topic: 'orders_v2',
  resource: '/orders/2195160686',
  user_id: '468424240',
  application_id: '5503910054141466',
  attempts: 1,
  sent: '2026-09-24T20:00:00.000Z',
};

const order = {
  id: 2195160686,
  status: 'paid',
  total_amount: 10_000,
  currency_id: 'ARS',
  date_created: '2026-09-24T19:59:00.000Z',
  buyer: { id: 123 },
  payments: [{ status: 'approved' }],
  shipping: { status: 'ready_to_ship' },
  order_items: [{ item: { id: 'MLA123' }, quantity: 2, unit_price: 5_000 }],
};

const withLock = async <T>(_resource: string, task: () => Promise<T>) => task();

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    client: { get: vi.fn().mockResolvedValue(order) },
    reserveEvent: vi.fn().mockResolvedValue({ id: 'stored-event', status: MarketplaceWebhookStatus.RECEIVED }),
    completeEvent: vi.fn().mockResolvedValue(undefined),
    failEvent: vi.fn().mockResolvedValue(undefined),
    findListing: vi.fn().mockResolvedValue({
      id: 'listing-1',
      supplierProduct: { id: 'product-1', supplierId: 'supplier-1', cost: 3_000 },
    }),
    upsertOrder: vi.fn().mockResolvedValue({ id: 'order-1' }),
    submitSupplierOrder: vi.fn().mockResolvedValue({ status: 'disabled' }),
    logger: vi.fn().mockResolvedValue(undefined),
    expectedApplicationId: '5503910054141466',
    withLock,
    ...overrides,
  };
}

describe('Mercado Libre orders webhook service', () => {
  it('parses only supported topics and safe resource paths', () => {
    expect(parseMercadoLibreNotification(notification)).toMatchObject({ topic: 'orders_v2' });
    expect(() => parseMercadoLibreNotification({ ...notification, resource: 'https://evil.test/orders/1' })).toThrow('inválida');
    expect(() => parseMercadoLibreNotification({ ...notification, topic: 'messages' })).toThrow('inválida');
  });

  it('verifies the resource and creates or updates one internal order', async () => {
    const deps = dependencies();

    const result = await processMercadoLibreNotification(notification, deps);

    expect(deps.client.get).toHaveBeenCalledWith('/orders/2195160686');
    expect(deps.findListing).toHaveBeenCalledWith('468424240', 'MLA123');
    expect(deps.upsertOrder).toHaveBeenCalledWith(expect.objectContaining({
      marketplaceOrderId: '2195160686', marketplaceAccountId: '468424240', listingId: 'listing-1',
      supplierId: 'supplier-1', supplierProductId: 'product-1', quantity: 2,
      salePrice: 10_000, supplierCost: 3_000, profit: 4_000,
      marketplaceFee: 0, shippingCost: 0, taxes: 0, financialsEstimated: true,
      status: OrderStatus.PROCESSING, paymentStatus: 'approved', shippingStatus: 'ready_to_ship',
      customerData: { id: 123 }, shippingData: { status: 'ready_to_ship' },
    }));
    expect(deps.completeEvent).toHaveBeenCalledWith('stored-event', MarketplaceWebhookStatus.PROCESSED, order);
    expect(deps.submitSupplierOrder).toHaveBeenCalledWith('order-1');
    expect(result.status).toBe('processed');
  });

  it('fails safely when the marketplace item is not linked to a supplier product', async () => {
    const deps = dependencies({ findListing: vi.fn().mockResolvedValue(null) });
    await expect(processMercadoLibreNotification(notification, deps)).rejects.toThrow('publicación vinculada');
    expect(deps.upsertOrder).not.toHaveBeenCalled();
    expect(deps.submitSupplierOrder).not.toHaveBeenCalled();
    expect(deps.failEvent).toHaveBeenCalled();
  });

  it.each(['payments', 'shipments', 'items'])('validates and stores the %s resource', async (topic) => {
    const resource = topic === 'payments' ? '/collections/1' : `/${topic}/1`;
    const deps = dependencies();
    const result = await processMercadoLibreNotification({ ...notification, topic, resource }, deps);

    expect(deps.client.get).toHaveBeenCalledWith(resource);
    expect(deps.completeEvent).toHaveBeenCalledWith('stored-event', MarketplaceWebhookStatus.PROCESSED, order);
    expect(deps.upsertOrder).not.toHaveBeenCalled();
    expect(result.status).toBe('processed');
  });

  it('does not fetch or write an order when the event was already processed', async () => {
    const deps = dependencies({
      reserveEvent: vi.fn().mockResolvedValue({ id: 'stored-event', status: MarketplaceWebhookStatus.PROCESSED }),
    });

    const result = await processMercadoLibreNotification(notification, deps);

    expect(result.status).toBe('duplicate');
    expect(deps.client.get).not.toHaveBeenCalled();
    expect(deps.upsertOrder).not.toHaveBeenCalled();
  });

  it('records a safe error and allows Mercado Libre to retry', async () => {
    const deps = dependencies({ client: { get: vi.fn().mockRejectedValue(new Error('HTTP 503')) } });

    await expect(processMercadoLibreNotification(notification, deps)).rejects.toThrow('HTTP 503');
    expect(deps.failEvent).toHaveBeenCalledWith('stored-event', 'HTTP 503');
    expect(deps.logger).toHaveBeenCalledWith('ERROR', 'mercado_libre_webhook', expect.any(String), expect.objectContaining({
      topic: 'orders_v2', resource: '/orders/2195160686', error: 'HTTP 503',
    }));
  });

  it('rejects notifications from another application before reserving an event', async () => {
    const deps = dependencies();
    await expect(processMercadoLibreNotification({ ...notification, application_id: 'other' }, deps)).rejects.toThrow('inválida');
    expect(deps.reserveEvent).not.toHaveBeenCalled();
  });
});
