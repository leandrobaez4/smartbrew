import { IntegrationLogStatus, SupplierIntegrationType } from '@prisma/client';
import { IntegrationOperation, recordIntegrationOperation } from '../integration-logs';
import { logSystemEvent } from '../logger';

export type SupplierProduct = {
  externalId: string;
  sku?: string | null;
  ean?: string | null;
  title: string;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  cost?: number | null;
  currency?: string | null;
  stock?: number | null;
  images?: string[];
  attributes?: Record<string, unknown> | null;
  pricing?: {
    supplierCurrency?: string | null;
    supplierPriceUsd?: number | null;
    exchangeRateArsPerUsd?: number | null;
    vatPercentage?: number | null;
    internalTaxAmountArs?: number | null;
    supplierCostWithTaxesArs?: number | null;
  };
  rawData: unknown;
};

export type SupplierPrice = { amount: number; currency: string };
export type SupplierOrderInput = {
  reference: string;
  items: Array<{ externalId: string; quantity: number }>;
  shippingAddress?: Record<string, string>;
};
export type SupplierOrder = { externalOrderId: string; status: string };
export type SupplierOrderStatus = { externalOrderId: string; status: string; updatedAt?: Date };

export const supplierCapabilities = [
  'catalog',
  'product',
  'price',
  'stock',
  'create-order',
  'order-status',
] as const;

export type SupplierCapability = typeof supplierCapabilities[number];

export interface SupplierConnector {
  getProducts(): Promise<SupplierProduct[]>;
  getProduct(externalId: string): Promise<SupplierProduct | null>;
  getStock(externalId: string): Promise<number | null>;
  getPrice(externalId: string): Promise<SupplierPrice | null>;
  createOrder(order: SupplierOrderInput): Promise<SupplierOrder>;
  getOrderStatus(externalOrderId: string): Promise<SupplierOrderStatus>;
}

export type SupplierConnectorConfig = {
  supplierId: string;
  slug: string;
  integrationType: SupplierIntegrationType;
  connectorKey?: string;
  website?: string | null;
  apiUrl?: string | null;
  sourceSnapshot?: unknown;
  normalizedCostArs?: number;
  normalizedPricing?: SupplierProduct['pricing'];
  credentials?: Readonly<{
    apiKey?: string;
    apiSecret?: string;
    username?: string;
    password?: string;
  }>;
};

type ConnectorOperation = keyof SupplierConnector;
export type SupplierConnectorBuilder = (config: SupplierConnectorConfig) => SupplierConnector;
export type SupplierConnectorRegistration = {
  key: string;
  aliases?: readonly string[];
  capabilities: readonly SupplierCapability[];
  builder: SupplierConnectorBuilder;
};

type RegisteredConnector = {
  key: string;
  capabilities: ReadonlySet<SupplierCapability>;
  builder: SupplierConnectorBuilder;
};
type IntegrationRecorder = (operation: IntegrationOperation) => Promise<unknown>;

const operationCapability: Record<ConnectorOperation, SupplierCapability> = {
  getProducts: 'catalog',
  getProduct: 'product',
  getStock: 'stock',
  getPrice: 'price',
  createOrder: 'create-order',
  getOrderStatus: 'order-status',
};

export interface SupplierIntegrationLogger {
  info(message: string, details: Record<string, unknown>): Promise<void>;
  error(message: string, details: Record<string, unknown>): Promise<void>;
}

export class SystemSupplierIntegrationLogger implements SupplierIntegrationLogger {
  async info(message: string, details: Record<string, unknown>) {
    await logSystemEvent('INFO', 'supplier_integration', message, details);
  }

  async error(message: string, details: Record<string, unknown>) {
    await logSystemEvent('ERROR', 'supplier_integration', message, details);
  }
}

export class SupplierConnectorError extends Error {
  readonly code: 'CONNECTOR_NOT_REGISTERED' | 'CAPABILITY_NOT_SUPPORTED' | 'SUPPLIER_CONNECTOR_FAILURE';
  readonly supplierId: string;
  readonly operation?: ConnectorOperation;

  constructor(options: {
    code: SupplierConnectorError['code'];
    message: string;
    supplierId: string;
    operation?: ConnectorOperation;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'SupplierConnectorError';
    this.code = options.code;
    this.supplierId = options.supplierId;
    this.operation = options.operation;
  }
}

class LoggedSupplierConnector implements SupplierConnector {
  readonly capabilities: readonly SupplierCapability[];

  constructor(
    private readonly config: SupplierConnectorConfig,
    readonly connectorKey: string,
    capabilities: ReadonlySet<SupplierCapability>,
    private readonly connector: SupplierConnector,
    private readonly logger: SupplierIntegrationLogger,
    private readonly recorder: IntegrationRecorder,
  ) {
    this.capabilities = supplierCapabilities.filter((capability) => capabilities.has(capability));
  }

  supports(capability: SupplierCapability) {
    return this.capabilities.includes(capability);
  }

  private assertCapability(operation: ConnectorOperation) {
    const capability = operationCapability[operation];
    if (this.supports(capability)) return;
    throw new SupplierConnectorError({
      code: 'CAPABILITY_NOT_SUPPORTED',
      message: `El conector ${this.connectorKey} no soporta la capacidad ${capability}.`,
      supplierId: this.config.supplierId,
      operation,
    });
  }

  private async record(operation: IntegrationOperation) {
    try {
      await this.recorder(operation);
    } catch (cause) {
      try {
        await this.logger.error('Integration log persistence failed', {
          supplierId: this.config.supplierId,
          supplierSlug: this.config.slug,
          operation: operation.operation,
          error: cause instanceof Error ? cause.message : 'Unknown integration log error',
        });
      } catch {
        // Observability failures must never change the connector operation result.
      }
    }
  }

  private async run<T>(operation: ConnectorOperation, request: unknown, task: () => Promise<T>) {
    this.assertCapability(operation);
    const startedAt = Date.now();
    const details = { supplierId: this.config.supplierId, supplierSlug: this.config.slug, operation };
    await this.logger.info('Supplier connector operation started', details);
    try {
      const result = await task();
      const durationMs = Date.now() - startedAt;
      await this.record({
        provider: this.config.slug,
        operation,
        request,
        response: result,
        status: IntegrationLogStatus.SUCCESS,
        durationMs,
      });
      await this.logger.info('Supplier connector operation succeeded', { ...details, durationMs });
      return result;
    } catch (cause) {
      const durationMs = Date.now() - startedAt;
      const error = cause instanceof Error ? cause.message : 'Unknown connector error';
      await this.record({
        provider: this.config.slug,
        operation,
        request,
        status: IntegrationLogStatus.ERROR,
        error,
        durationMs,
      });
      await this.logger.error('Supplier connector operation failed', {
        ...details,
        durationMs,
        error,
      });
      throw new SupplierConnectorError({
        code: 'SUPPLIER_CONNECTOR_FAILURE',
        message: `Falló la operación ${operation} del proveedor ${this.config.slug}.`,
        supplierId: this.config.supplierId,
        operation,
        cause,
      });
    }
  }

  getProducts() { return this.run('getProducts', {}, () => this.connector.getProducts()); }
  getProduct(externalId: string) { return this.run('getProduct', { externalId }, () => this.connector.getProduct(externalId)); }
  getStock(externalId: string) { return this.run('getStock', { externalId }, () => this.connector.getStock(externalId)); }
  getPrice(externalId: string) { return this.run('getPrice', { externalId }, () => this.connector.getPrice(externalId)); }
  createOrder(order: SupplierOrderInput) {
    return this.run('createOrder', {
      reference: order.reference,
      items: order.items,
      hasShippingAddress: Boolean(order.shippingAddress),
    }, () => this.connector.createOrder(order));
  }
  getOrderStatus(externalOrderId: string) {
    return this.run('getOrderStatus', { externalOrderId }, () => this.connector.getOrderStatus(externalOrderId));
  }
}

export class SupplierConnectorFactory {
  private readonly registrations = new Map<string, RegisteredConnector>();

  private readonly recorder: IntegrationRecorder;

  constructor(
    private readonly logger: SupplierIntegrationLogger = new SystemSupplierIntegrationLogger(),
    recorder?: IntegrationRecorder,
  ) {
    this.recorder = recorder || (logger instanceof SystemSupplierIntegrationLogger
      ? recordIntegrationOperation
      : async () => undefined);
  }

  register(key: string, builder: SupplierConnectorBuilder): this;
  register(registration: SupplierConnectorRegistration): this;
  register(keyOrRegistration: string | SupplierConnectorRegistration, builder?: SupplierConnectorBuilder) {
    const registration = typeof keyOrRegistration === 'string'
      ? { key: keyOrRegistration, builder: builder!, capabilities: supplierCapabilities, aliases: [] }
      : keyOrRegistration;
    const key = registration.key.trim().toLowerCase();
    if (!key) throw new Error('Connector key is required');
    if (!registration.builder) throw new Error('Connector builder is required');
    const capabilities = new Set(registration.capabilities);
    if (capabilities.size !== registration.capabilities.length) throw new Error(`Connector ${key} has duplicate capabilities`);
    for (const capability of capabilities) {
      if (!supplierCapabilities.includes(capability)) throw new Error(`Unknown supplier capability: ${capability}`);
    }
    const aliases = (registration.aliases || []).map((alias) => alias.trim().toLowerCase());
    if (aliases.some((alias) => !alias)) throw new Error('Connector aliases cannot be empty');
    const registrationKeys = [...new Set([key, ...aliases])];
    const duplicate = registrationKeys.find((registrationKey) => this.registrations.has(registrationKey));
    if (duplicate) throw new Error(`Connector key already registered: ${duplicate}`);
    const registered = { key, capabilities, builder: registration.builder };
    for (const registrationKey of registrationKeys) this.registrations.set(registrationKey, registered);
    return this;
  }

  make(config: SupplierConnectorConfig) {
    const key = (config.connectorKey || config.integrationType).trim().toLowerCase();
    const registration = this.registrations.get(key);
    if (!registration) {
      throw new SupplierConnectorError({
        code: 'CONNECTOR_NOT_REGISTERED',
        message: `No existe un conector registrado para ${key}.`,
        supplierId: config.supplierId,
      });
    }
    return new LoggedSupplierConnector(
      config,
      registration.key,
      registration.capabilities,
      registration.builder(config),
      this.logger,
      this.recorder,
    );
  }
}
