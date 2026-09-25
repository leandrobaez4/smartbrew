import { AlertType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { alertFromSystemEvent, persistAlertFromSystemEvent } from './alerts';

describe('alerts', () => {
  it.each([
    ['SUPPLIER_OUT_OF_STOCK', AlertType.SUPPLIER_OUT_OF_STOCK],
    ['SUPPLIER_PRICE_INCREASE', AlertType.SUPPLIER_PRICE_INCREASE],
    ['LOW_MARGIN', AlertType.LOW_MARGIN],
    ['PRICE_ANOMALY', AlertType.PRICE_ANOMALY],
  ])('maps %s system events', (source, type) => {
    expect(alertFromSystemEvent('WARN', source, 'message', { listingId: 'listing-1' })).toMatchObject({
      type, origin: source, entityType: 'MarketplaceListing', entityId: 'listing-1', message: 'message',
    });
  });

  it.each([
    ['supplier_sync', AlertType.SUPPLIER_API_ERROR],
    ['supplier_integration', AlertType.SUPPLIER_API_ERROR],
    ['supplier_order_status_sync', AlertType.SUPPLIER_API_ERROR],
    ['supplier_order', AlertType.ORDER_CREATION_ERROR],
    ['marketplace_stock_sync', AlertType.MARKETPLACE_SYNC_ERROR],
    ['mercado_libre_webhook', AlertType.MARKETPLACE_SYNC_ERROR],
  ])('maps error source %s', (source, type) => {
    expect(alertFromSystemEvent('ERROR', source, 'failed', { supplierId: 'supplier-1' })).toMatchObject({
      type, entityType: 'Supplier', entityId: 'supplier-1',
    });
  });

  it('ignores successful operational logs', () => {
    expect(alertFromSystemEvent('INFO', 'supplier_sync', 'completed', {})).toBeNull();
  });

  it('persists a queryable unread alert', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'alert-1', readAt: null });
    const result = await persistAlertFromSystemEvent('ERROR', 'supplier_order', 'failed', { orderId: 'order-1' }, { alert: { create } } as never);
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      type: AlertType.ORDER_CREATION_ERROR,
      entityType: 'Order',
      entityId: 'order-1',
    }) });
    expect(result).toEqual({ id: 'alert-1', readAt: null });
  });
});
