import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { SupplierConnectorFactory } from './connectors';
import {
  MockSupplierConnector,
  MockSupplierScenarioError,
  registerMockSupplierConnector,
} from './mock';
import { supplierConnectorConfig } from './sync';

describe('MockSupplierConnector', () => {
  it('provides a safe default catalog without external APIs', async () => {
    const connector = new MockSupplierConnector();
    await expect(connector.getProducts()).resolves.toEqual([
      expect.objectContaining({ externalId: 'TEST-001', sku: 'TEST-001', cost: 25_000, stock: 15 }),
    ]);
  });

  it('simulates price changes, stock changes and out of stock', async () => {
    const connector = new MockSupplierConnector();
    connector.setPrice('TEST-001', 27_500);
    connector.setStock('TEST-001', 8);
    await expect(connector.getPrice('TEST-001')).resolves.toEqual({ amount: 27_500, currency: 'ARS' });
    await expect(connector.getStock('TEST-001')).resolves.toBe(8);
    connector.setStock('TEST-001', 0);
    await expect(connector.getStock('TEST-001')).resolves.toBe(0);
  });

  it('configures an API failure per operation and can recover it', async () => {
    const connector = new MockSupplierConnector({ failures: { getPrice: 'simulated upstream error' } });
    await expect(connector.getPrice('TEST-001')).rejects.toEqual(expect.objectContaining<Partial<MockSupplierScenarioError>>({
      code: 'MOCK_API_ERROR', operation: 'getPrice', message: 'simulated upstream error',
    }));
    connector.setFailure('getPrice');
    await expect(connector.getPrice('TEST-001')).resolves.toEqual({ amount: 25_000, currency: 'ARS' });
  });

  it('simulates a bounded timeout without calling an external API', async () => {
    const connector = new MockSupplierConnector({ timeouts: { getStock: 1 } });
    await expect(connector.getStock('TEST-001')).rejects.toEqual(expect.objectContaining<Partial<MockSupplierScenarioError>>({
      code: 'MOCK_TIMEOUT', operation: 'getStock',
    }));
  });

  it('creates orders and exposes configurable order status transitions', async () => {
    const connector = new MockSupplierConnector({ initialOrderStatus: 'processing' });
    const order = await connector.createOrder({
      reference: 'ML-1', items: [{ externalId: 'TEST-001', quantity: 2 }],
    });
    expect(order).toEqual({ externalOrderId: 'MOCK-ORDER-0001', status: 'processing' });
    connector.setOrderStatus(order.externalOrderId, 'shipped');
    await expect(connector.getOrderStatus(order.externalOrderId)).resolves.toEqual(expect.objectContaining({
      externalOrderId: 'MOCK-ORDER-0001', status: 'shipped', updatedAt: expect.any(Date),
    }));
  });

  it('integrates through SupplierConnectorFactory using supplier type mock', async () => {
    const logger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
    const factory = registerMockSupplierConnector(new SupplierConnectorFactory(logger));
    const supplier = {
      id: 'supplier-mock', name: 'Mock', slug: 'mock', type: 'mock', website: null, apiUrl: null,
      apiKeyEncrypted: null, apiSecretEncrypted: null, usernameEncrypted: null, passwordEncrypted: null,
      integrationType: SupplierIntegrationType.API, status: SupplierStatus.ACTIVE, lastSyncAt: null,
      createdAt: new Date(0), updatedAt: new Date(0),
    };
    const connector = factory.make(supplierConnectorConfig(supplier));
    await expect(connector.getStock('TEST-001')).resolves.toBe(15);
    expect(logger.info).toHaveBeenCalledWith('Supplier connector operation succeeded', expect.objectContaining({
      supplierId: 'supplier-mock', operation: 'getStock',
    }));
  });

  it('preserves mock order state across factory calls for the same supplier', async () => {
    const factory = registerMockSupplierConnector(new SupplierConnectorFactory({
      info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined),
    }));
    const config = {
      supplierId: 'supplier-mock', slug: 'mock', connectorKey: 'mock',
      integrationType: SupplierIntegrationType.API,
    };
    const order = await factory.make(config).createOrder({
      reference: 'ML-1', items: [{ externalId: 'TEST-001', quantity: 1 }],
    });
    await expect(factory.make(config).getOrderStatus(order.externalOrderId)).resolves.toEqual(expect.objectContaining({
      externalOrderId: order.externalOrderId, status: 'pending',
    }));
  });
});
