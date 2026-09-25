import {
  SupplierConnector,
  SupplierConnectorFactory,
  SupplierOrder,
  SupplierOrderInput,
  SupplierOrderStatus,
  SupplierProduct,
} from './connectors';

export type MockSupplierOperation = keyof SupplierConnector;

export type MockSupplierScenario = {
  products?: SupplierProduct[];
  failures?: Partial<Record<MockSupplierOperation, string>>;
  timeouts?: Partial<Record<MockSupplierOperation, number>>;
  initialOrderStatus?: string;
};

const defaultProduct: SupplierProduct = {
  externalId: 'TEST-001',
  sku: 'TEST-001',
  title: 'Auriculares Bluetooth',
  cost: 25_000,
  currency: 'ARS',
  stock: 15,
  images: [],
  rawData: { source: 'mock', sku: 'TEST-001' },
};

function cloneProduct(product: SupplierProduct): SupplierProduct {
  return {
    ...product,
    images: [...(product.images || [])],
    attributes: product.attributes ? structuredClone(product.attributes) : product.attributes,
    rawData: structuredClone(product.rawData),
  };
}

export class MockSupplierScenarioError extends Error {
  constructor(
    readonly code: 'MOCK_API_ERROR' | 'MOCK_TIMEOUT',
    message: string,
    readonly operation: MockSupplierOperation,
  ) {
    super(message);
    this.name = 'MockSupplierScenarioError';
  }
}

export class MockSupplierConnector implements SupplierConnector {
  private readonly products = new Map<string, SupplierProduct>();

  private readonly orders = new Map<string, SupplierOrderStatus>();

  private readonly failures: Partial<Record<MockSupplierOperation, string>>;

  private readonly timeouts: Partial<Record<MockSupplierOperation, number>>;

  private readonly initialOrderStatus: string;

  private nextOrderNumber = 1;

  constructor(scenario: MockSupplierScenario = {}) {
    for (const product of scenario.products || [defaultProduct]) {
      this.products.set(product.externalId, cloneProduct(product));
    }
    this.failures = { ...scenario.failures };
    this.timeouts = { ...scenario.timeouts };
    this.initialOrderStatus = scenario.initialOrderStatus || 'pending';
  }

  private async applyScenario(operation: MockSupplierOperation) {
    const timeoutMs = this.timeouts[operation];
    if (timeoutMs != null) {
      if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 60_000) {
        throw new Error(`Invalid mock timeout for ${operation}`);
      }
      await new Promise((resolve) => setTimeout(resolve, timeoutMs));
      throw new MockSupplierScenarioError('MOCK_TIMEOUT', `Mock timeout during ${operation}`, operation);
    }
    const failure = this.failures[operation];
    if (failure) throw new MockSupplierScenarioError('MOCK_API_ERROR', failure, operation);
  }

  setStock(externalId: string, stock: number) {
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Mock stock must be a non-negative integer');
    const product = this.requireProduct(externalId);
    product.stock = stock;
  }

  setPrice(externalId: string, amount: number, currency?: string) {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Mock price must be a finite non-negative number');
    const product = this.requireProduct(externalId);
    product.cost = amount;
    if (currency) product.currency = currency;
  }

  setFailure(operation: MockSupplierOperation, message?: string) {
    if (message) this.failures[operation] = message;
    else delete this.failures[operation];
  }

  setTimeout(operation: MockSupplierOperation, timeoutMs?: number) {
    if (timeoutMs == null) delete this.timeouts[operation];
    else this.timeouts[operation] = timeoutMs;
  }

  setOrderStatus(externalOrderId: string, status: string) {
    const order = this.orders.get(externalOrderId);
    if (!order) throw new Error(`Unknown mock order ${externalOrderId}`);
    this.orders.set(externalOrderId, { ...order, status, updatedAt: new Date() });
  }

  private requireProduct(externalId: string) {
    const product = this.products.get(externalId);
    if (!product) throw new Error(`Unknown mock product ${externalId}`);
    return product;
  }

  async getProducts() {
    await this.applyScenario('getProducts');
    return [...this.products.values()].map(cloneProduct);
  }

  async getProduct(externalId: string) {
    await this.applyScenario('getProduct');
    const product = this.products.get(externalId);
    return product ? cloneProduct(product) : null;
  }

  async getStock(externalId: string) {
    await this.applyScenario('getStock');
    return this.products.get(externalId)?.stock ?? null;
  }

  async getPrice(externalId: string) {
    await this.applyScenario('getPrice');
    const product = this.products.get(externalId);
    if (!product || product.cost == null || !product.currency) return null;
    return { amount: product.cost, currency: product.currency };
  }

  async createOrder(order: SupplierOrderInput): Promise<SupplierOrder> {
    await this.applyScenario('createOrder');
    for (const item of order.items) this.requireProduct(item.externalId);
    const externalOrderId = `MOCK-ORDER-${String(this.nextOrderNumber).padStart(4, '0')}`;
    this.nextOrderNumber += 1;
    this.orders.set(externalOrderId, {
      externalOrderId,
      status: this.initialOrderStatus,
      updatedAt: new Date(),
    });
    return { externalOrderId, status: this.initialOrderStatus };
  }

  async getOrderStatus(externalOrderId: string) {
    await this.applyScenario('getOrderStatus');
    const order = this.orders.get(externalOrderId);
    if (!order) throw new Error(`Unknown mock order ${externalOrderId}`);
    return { ...order };
  }
}

export function registerMockSupplierConnector(
  factory: SupplierConnectorFactory,
  scenario: MockSupplierScenario = {},
) {
  const connectors = new Map<string, MockSupplierConnector>();
  return factory.register('mock', (config) => {
    const existing = connectors.get(config.supplierId);
    if (existing) return existing;
    const connector = new MockSupplierConnector(scenario);
    connectors.set(config.supplierId, connector);
    return connector;
  });
}
