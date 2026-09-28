import { z } from 'zod';
import { SupplierConnector, SupplierConnectorFactory, SupplierProduct } from './connectors';

const optionalText = z.string().trim().min(1).max(500).nullable().optional();

export const ManualSupplierSnapshotSchema = z.object({
  externalId: z.string().trim().min(1).max(128),
  sku: optionalText,
  ean: optionalText,
  title: z.string().trim().min(1).max(500),
  description: optionalText,
  brand: optionalText,
  category: optionalText,
  cost: z.number().finite().nonnegative().max(1_000_000_000).nullable().optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable().optional(),
  stock: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  images: z.array(z.string().url()).max(30).default([]),
  attributes: z.record(z.string(), z.unknown()).nullable().optional(),
  rawData: z.unknown().optional(),
}).superRefine((value, context) => {
  if (value.cost != null && !value.currency) {
    context.addIssue({ code: 'custom', message: 'Currency is required when cost is present.', path: ['currency'] });
  }
});

function unavailable(): never {
  throw new Error('Operation unavailable for a manually managed supplier snapshot.');
}

export function normalizeManualSupplierSnapshot(snapshot: unknown): SupplierProduct {
  const product = ManualSupplierSnapshotSchema.parse(snapshot);
  return {
    externalId: product.externalId,
    sku: product.sku ?? null,
    ean: product.ean ?? null,
    title: product.title,
    description: product.description ?? null,
    brand: product.brand ?? null,
    category: product.category ?? null,
    cost: product.cost ?? null,
    currency: product.currency ?? null,
    stock: product.stock ?? null,
    images: product.images,
    attributes: product.attributes ?? null,
    rawData: product.rawData ?? snapshot,
  };
}

class ManualSupplierConnector implements SupplierConnector {
  constructor(private readonly snapshot: unknown) {}

  async getProduct(externalId: string) {
    const product = normalizeManualSupplierSnapshot(this.snapshot);
    return product.externalId === externalId ? product : null;
  }

  async getProducts() { return unavailable(); }
  async getStock() { return unavailable(); }
  async getPrice() { return unavailable(); }
  async createOrder() { return unavailable(); }
  async getOrderStatus() { return unavailable(); }
}

export function registerManualSupplierConnector(factory: SupplierConnectorFactory) {
  return factory.register({
    key: 'manual-v1',
    aliases: ['manual'],
    capabilities: ['product'],
    builder: (config) => new ManualSupplierConnector(config.sourceSnapshot),
  });
}
