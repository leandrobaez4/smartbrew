import { UnidropSnapshotSchema } from '../unidrop-import';
import { SupplierConnector, SupplierConnectorFactory, SupplierProduct } from './connectors';

function unavailable(): never {
  throw new Error('Operation unavailable for an imported Unidrop browser snapshot.');
}

export function normalizeUnidropSnapshot(snapshot: unknown): SupplierProduct {
  const product = UnidropSnapshotSchema.parse(snapshot);
  return {
    externalId: product.externalId,
    sku: product.sku,
    ean: product.ean ?? null,
    title: product.title,
    description: product.description ?? null,
    brand: product.brand ?? null,
    category: product.category ?? null,
    cost: product.costArs,
    currency: 'ARS',
    stock: product.stock,
    images: product.images,
    attributes: {
      ...product.attributes,
      sellerPackageWeightGrams: product.package.weightGrams ?? null,
      sellerPackageHeightCm: product.package.heightCm ?? null,
      sellerPackageWidthCm: product.package.widthCm ?? null,
      sellerPackageLengthCm: product.package.lengthCm ?? null,
    },
    pricing: {
      supplierCurrency: 'ARS',
      supplierCostWithTaxesArs: product.costArs,
    },
    rawData: {
      sourceProductId: product.sourceProductId,
      sourceUrl: product.sourceUrl,
      capturedAt: product.capturedAt,
      priceWithProfitArs: product.priceWithProfitArs ?? null,
      shippingReference: product.shippingReference ?? null,
    },
  };
}

class UnidropSnapshotConnector implements SupplierConnector {
  constructor(private readonly snapshot: unknown) {}

  async getProduct(externalId: string) {
    const product = normalizeUnidropSnapshot(this.snapshot);
    return externalId === product.externalId ? product : null;
  }

  async getProducts() { return unavailable(); }
  async getStock() { return unavailable(); }
  async getPrice() { return unavailable(); }
  async createOrder() { return unavailable(); }
  async getOrderStatus() { return unavailable(); }
}

export function registerUnidropSnapshotConnector(factory: SupplierConnectorFactory) {
  return factory.register({
    key: 'unidrop-snapshot-v1',
    aliases: ['unidrop'],
    capabilities: ['product'],
    builder: (config) => new UnidropSnapshotConnector(config.sourceSnapshot),
  });
}
