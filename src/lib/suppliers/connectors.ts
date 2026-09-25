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
  credentials?: Readonly<{
    apiKey?: string;
    apiSecret?: string;
    username?: string;
    password?: string;
  }>;
};

type ConnectorOperation = keyof SupplierConnector;
type ConnectorBuilder = (config: SupplierConnectorConfig) => SupplierConnector;
type IntegrationRecorder = (operation: IntegrationOperation) => Promise<unknown>;

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
  readonly code: 'CONNECTOR_NOT_REGISTERED' | 'SUPPLIER_CONNECTOR_FAILURE';
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
  constructor(
    private readonly config: SupplierConnectorConfig,
    private readonly connector: SupplierConnector,
    private readonly logger: SupplierIntegrationLogger,
    private readonly recorder: IntegrationRecorder,
  ) {}

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
  private readonly builders = new Map<string, ConnectorBuilder>();

  private readonly recorder: IntegrationRecorder;

  constructor(
    private readonly logger: SupplierIntegrationLogger = new SystemSupplierIntegrationLogger(),
    recorder?: IntegrationRecorder,
  ) {
    this.recorder = recorder || (logger instanceof SystemSupplierIntegrationLogger
      ? recordIntegrationOperation
      : async () => undefined);
  }

  register(key: string, builder: ConnectorBuilder) {
    const normalized = key.trim().toLowerCase();
    if (!normalized) throw new Error('Connector key is required');
    this.builders.set(normalized, builder);
    return this;
  }

  make(config: SupplierConnectorConfig) {
    const key = (config.connectorKey || config.integrationType).trim().toLowerCase();
    const builder = this.builders.get(key);
    if (!builder) {
      throw new SupplierConnectorError({
        code: 'CONNECTOR_NOT_REGISTERED',
        message: `No existe un conector registrado para ${key}.`,
        supplierId: config.supplierId,
      });
    }
    return new LoggedSupplierConnector(config, builder(config), this.logger, this.recorder);
  }
}
