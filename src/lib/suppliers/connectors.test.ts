import { IntegrationLogStatus, SupplierIntegrationType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SupplierConnector,
  SupplierConnectorError,
  SupplierConnectorFactory,
  SupplierIntegrationLogger,
} from './connectors';

const config = {
  supplierId: 'supplier-1',
  slug: 'proveedor-uno',
  integrationType: SupplierIntegrationType.API,
};

function fakeConnector(overrides: Partial<SupplierConnector> = {}): SupplierConnector {
  return {
    getProducts: vi.fn().mockResolvedValue([{ externalId: 'p-1', title: 'Producto', rawData: { id: 'p-1' } }]),
    getProduct: vi.fn().mockResolvedValue({ externalId: 'p-1', title: 'Producto', rawData: { id: 'p-1' } }),
    getStock: vi.fn().mockResolvedValue(5),
    getPrice: vi.fn().mockResolvedValue({ amount: 100, currency: 'ARS' }),
    createOrder: vi.fn().mockResolvedValue({ externalOrderId: 'o-1', status: 'created' }),
    getOrderStatus: vi.fn().mockResolvedValue({ externalOrderId: 'o-1', status: 'created' }),
    ...overrides,
  };
}

describe('SupplierConnectorFactory', () => {
  let logger: SupplierIntegrationLogger;

  beforeEach(() => {
    logger = { info: vi.fn().mockResolvedValue(undefined), error: vi.fn().mockResolvedValue(undefined) };
  });

  it('adds connectors through registration without provider-specific core changes', async () => {
    const raw = fakeConnector();
    const factory = new SupplierConnectorFactory(logger).register('api', () => raw);
    const connector = factory.make(config);

    await expect(connector.getProducts()).resolves.toEqual([{ externalId: 'p-1', title: 'Producto', rawData: { id: 'p-1' } }]);
    await expect(connector.getStock('p-1')).resolves.toBe(5);
    expect(raw.getStock).toHaveBeenCalledWith('p-1');
  });

  it('records relevant operations without shipping or credential values', async () => {
    const recorder = vi.fn().mockResolvedValue(undefined);
    const factory = new SupplierConnectorFactory(logger, recorder).register('api', () => fakeConnector());

    await factory.make({ ...config, credentials: { apiKey: 'top-secret' } }).createOrder({
      reference: 'ML-1',
      items: [{ externalId: 'p-1', quantity: 1 }],
      shippingAddress: { street: 'Private street 123' },
    });

    expect(recorder).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'proveedor-uno',
      operation: 'createOrder',
      status: IntegrationLogStatus.SUCCESS,
      request: { reference: 'ML-1', items: [{ externalId: 'p-1', quantity: 1 }], hasShippingAddress: true },
    }));
    expect(JSON.stringify(recorder.mock.calls)).not.toContain('top-secret');
    expect(JSON.stringify(recorder.mock.calls)).not.toContain('Private street 123');
  });

  it('does not turn a successful connector call into a failure when logging is unavailable', async () => {
    const recorder = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const factory = new SupplierConnectorFactory(logger, recorder).register('api', () => fakeConnector());

    await expect(factory.make(config).getStock('p-1')).resolves.toBe(5);
    expect(logger.error).toHaveBeenCalledWith('Integration log persistence failed', expect.objectContaining({
      operation: 'getStock',
    }));
  });

  it('fails clearly when no connector is registered', () => {
    expect(() => new SupplierConnectorFactory(logger).make(config)).toThrowError(
      expect.objectContaining({ code: 'CONNECTOR_NOT_REGISTERED', supplierId: 'supplier-1' }),
    );
  });

  it('centralizes connector errors and logs safe operation metadata', async () => {
    const factory = new SupplierConnectorFactory(logger).register('api', () => fakeConnector({
      getPrice: vi.fn().mockRejectedValue(new Error('remote timeout')),
    }));

    await expect(factory.make(config).getPrice('p-1')).rejects.toEqual(
      expect.objectContaining<Partial<SupplierConnectorError>>({
        code: 'SUPPLIER_CONNECTOR_FAILURE',
        supplierId: 'supplier-1',
        operation: 'getPrice',
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Supplier connector operation failed',
      expect.objectContaining({ supplierId: 'supplier-1', supplierSlug: 'proveedor-uno', operation: 'getPrice' }),
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('credentials');
  });
});
