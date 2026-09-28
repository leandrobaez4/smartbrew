import { ElitImportProductSchema } from '../elit-import';
import { SupplierConnector, SupplierConnectorFactory, SupplierProduct } from './connectors';

function unavailable(): never {
  throw new Error('Operation unavailable for an imported Elit snapshot.');
}

export function normalizeElitSnapshot(
  snapshot: unknown,
  normalizedCostArs?: number,
  normalizedPricing?: SupplierProduct['pricing'],
): SupplierProduct {
  const product = ElitImportProductSchema.parse(snapshot);
  return {
    externalId: product.externalId,
    sku: product.sku,
    ean: product.ean,
    title: product.title,
    description: product.description,
    brand: product.brand,
    category: product.category,
    cost: normalizedCostArs ?? product.pricing.supplierCostWithVatArs,
    currency: normalizedCostArs != null || product.pricing.supplierCostWithVatArs != null ? 'ARS' : null,
    stock: product.stock,
    images: product.images,
    attributes: product.attributes,
    pricing: normalizedPricing ?? {
      supplierCurrency: 'USD',
      supplierPriceUsd: product.pricing.supplierPriceUsd,
      exchangeRateArsPerUsd: product.pricing.exchangeRateArsPerUsd,
      vatPercentage: product.pricing.vatPercentage,
      supplierCostWithTaxesArs: normalizedCostArs ?? product.pricing.supplierCostWithVatArs,
    },
    rawData: {
      ...product.rawData,
      sourceUrl: product.sourceUrl,
      capturedPricing: product.pricing,
    },
  };
}

class ElitSnapshotConnector implements SupplierConnector {
  constructor(
    private readonly snapshot: unknown,
    private readonly normalizedCostArs?: number,
    private readonly normalizedPricing?: SupplierProduct['pricing'],
  ) {}

  async getProduct(externalId: string) {
    const product = normalizeElitSnapshot(this.snapshot, this.normalizedCostArs, this.normalizedPricing);
    return externalId === product.externalId ? product : null;
  }

  async getProducts() { return unavailable(); }
  async getStock() { return unavailable(); }
  async getPrice() { return unavailable(); }
  async createOrder() { return unavailable(); }
  async getOrderStatus() { return unavailable(); }
}

export function registerElitSnapshotConnector(factory: SupplierConnectorFactory) {
  return factory.register({
    key: 'elit-snapshot-v1',
    aliases: ['elit'],
    capabilities: ['product'],
    builder: (config) => new ElitSnapshotConnector(
      config.sourceSnapshot,
      config.normalizedCostArs,
      config.normalizedPricing,
    ),
  });
}
