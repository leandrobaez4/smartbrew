import { MarketplaceListingStatus, Prisma } from '@prisma/client';
import { logSystemEvent } from '../logger';
import { portalDb } from '../portal';
import { importSupplierProducts } from './catalog';
import { SupplierConnectorFactory, SupplierProduct } from './connectors';
import { supplierConnectorConfig, supplierConnectorFactory } from './sync';

type MonitorStore = Pick<typeof portalDb, 'marketplaceListing'>;
type MonitorLogger = typeof logSystemEvent;

function rawData(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : { previousRawData: value };
}

export async function monitorPublishedSupplierProducts(options: {
  supplierId?: string;
  store?: MonitorStore;
  factory?: SupplierConnectorFactory;
  logger?: MonitorLogger;
  importProducts?: typeof importSupplierProducts;
  syncedAt?: Date;
} = {}) {
  const store = options.store || portalDb;
  const factory = options.factory || supplierConnectorFactory;
  const logger = options.logger || logSystemEvent;
  const importProducts = options.importProducts || importSupplierProducts;
  const syncedAt = options.syncedAt || new Date();
  const listings = await store.marketplaceListing.findMany({
    where: {
      marketplace: 'MERCADO_LIBRE',
      status: { in: [MarketplaceListingStatus.ACTIVE, MarketplaceListingStatus.PAUSED] },
      supplierProduct: {
        supplier: { status: 'ACTIVE' },
        ...(options.supplierId ? { supplierId: options.supplierId } : {}),
      },
    },
    select: {
      supplierProduct: {
        select: {
          id: true,
          externalId: true,
          sku: true,
          ean: true,
          title: true,
          description: true,
          brand: true,
          category: true,
          cost: true,
          currency: true,
          stock: true,
          images: true,
          attributes: true,
          rawData: true,
          supplier: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const products = new Map(listings.map((listing) => [listing.supplierProduct.id, listing.supplierProduct]));
  const results: Array<{
    supplierProductId: string;
    supplierId: string;
    externalId: string;
    status: 'success' | 'missing' | 'skipped' | 'failed';
    error?: string;
  }> = [];

  for (const current of products.values()) {
    const details = {
      supplierId: current.supplier.id,
      supplierSlug: current.supplier.slug,
      supplierProductId: current.id,
      externalId: current.externalId,
    };
    try {
      const connector = factory.make(supplierConnectorConfig(current.supplier));
      let product: SupplierProduct | null = null;
      if (connector.supports('product')) {
        product = await connector.getProduct(current.externalId);
      } else if (connector.supports('price') || connector.supports('stock')) {
        const [price, stock] = await Promise.all([
          connector.supports('price') ? connector.getPrice(current.externalId) : null,
          connector.supports('stock') ? connector.getStock(current.externalId) : null,
        ]);
        product = {
          externalId: current.externalId,
          sku: current.sku,
          ean: current.ean,
          title: current.title,
          description: current.description,
          brand: current.brand,
          category: current.category,
          cost: price?.amount ?? (current.cost == null ? null : Number(current.cost)),
          currency: price?.currency ?? current.currency,
          stock: stock ?? current.stock,
          images: current.images,
          attributes: current.attributes && typeof current.attributes === 'object' && !Array.isArray(current.attributes)
            ? current.attributes as Record<string, unknown>
            : null,
          rawData: { ...rawData(current.rawData), monitoredAt: syncedAt.toISOString() },
        };
      } else {
        results.push({ ...details, status: 'skipped' });
        await logger('INFO', 'supplier_product_monitor', 'Published supplier product skipped because its connector cannot monitor it', details);
        continue;
      }

      if (!product) {
        results.push({ ...details, status: 'missing' });
        await logger('WARN', 'supplier_product_monitor', 'Published supplier product was not returned by its provider', details);
        continue;
      }
      await importProducts(current.supplier.id, [product], syncedAt);
      results.push({ ...details, status: 'success' });
      await logger('INFO', 'supplier_product_monitor', 'Published supplier product synchronized', details);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown supplier product monitoring error';
      results.push({ ...details, status: 'failed', error: message });
      await logger('ERROR', 'supplier_product_monitor', 'Published supplier product synchronization failed', {
        ...details,
        error: message,
      });
    }
  }

  const summary = {
    requestedSupplierId: options.supplierId || null,
    inspected: products.size,
    succeeded: results.filter((result) => result.status === 'success').length,
    missing: results.filter((result) => result.status === 'missing').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
  await logger(summary.failed ? 'WARN' : 'INFO', 'supplier_product_monitor', 'Published supplier product monitoring finished', summary);
  return summary;
}
