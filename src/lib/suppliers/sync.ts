import { Supplier } from '@prisma/client';
import { logSystemEvent } from '../logger';
import { portalDb } from '../portal';
import { openSupplierCredential } from '../supplier-credentials';
import { importSupplierProducts } from './catalog';
import { SupplierConnectorFactory } from './connectors';
import { registerMockSupplierConnector } from './mock';

type SupplierStore = Pick<typeof portalDb, 'supplier'>;
type SyncLogger = typeof logSystemEvent;

export const supplierConnectorFactory = registerMockSupplierConnector(new SupplierConnectorFactory());

function credential(value: string | null, supplierId: string, field: string) {
  return value ? openSupplierCredential(value, supplierId, field) : undefined;
}

export function supplierConnectorConfig(supplier: Supplier) {
  return {
    supplierId: supplier.id,
    slug: supplier.slug,
    integrationType: supplier.integrationType,
    connectorKey: supplier.type?.trim().toLowerCase() === 'mock' ? 'mock' : undefined,
    website: supplier.website,
    apiUrl: supplier.apiUrl,
    credentials: {
      apiKey: credential(supplier.apiKeyEncrypted, supplier.id, 'apiKey'),
      apiSecret: credential(supplier.apiSecretEncrypted, supplier.id, 'apiSecret'),
      username: credential(supplier.usernameEncrypted, supplier.id, 'username'),
      password: credential(supplier.passwordEncrypted, supplier.id, 'password'),
    },
  };
}

export function supplierSyncIntervalMs(value = process.env.SUPPLIER_SYNC_INTERVAL) {
  const minutes = Number(value || 15);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error('SUPPLIER_SYNC_INTERVAL must be an integer between 1 and 1440 minutes');
  }
  return minutes * 60_000;
}

export async function syncSuppliers(options: {
  supplierId?: string;
  store?: SupplierStore;
  factory?: SupplierConnectorFactory;
  logger?: SyncLogger;
  importProducts?: typeof importSupplierProducts;
} = {}) {
  const store = options.store || portalDb;
  const factory = options.factory || supplierConnectorFactory;
  const logger = options.logger || logSystemEvent;
  const importProducts = options.importProducts || importSupplierProducts;
  const suppliers = await store.supplier.findMany({
    where: { status: 'ACTIVE', ...(options.supplierId ? { id: options.supplierId } : {}) },
    orderBy: { name: 'asc' },
  });
  const results: Array<{ supplierId: string; slug: string; status: 'success' | 'failed'; imported?: number; error?: string }> = [];

  for (const supplier of suppliers) {
    try {
      const products = await factory.make(supplierConnectorConfig(supplier)).getProducts();
      const imported = await importProducts(supplier.id, products);
      results.push({ supplierId: supplier.id, slug: supplier.slug, status: 'success', imported: imported.imported });
      await logger('INFO', 'supplier_sync', 'Supplier catalog synchronized', {
        supplierId: supplier.id,
        supplierSlug: supplier.slug,
        imported: imported.imported,
        syncedAt: imported.syncedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown supplier synchronization error';
      results.push({ supplierId: supplier.id, slug: supplier.slug, status: 'failed', error: message });
      await logger('ERROR', 'supplier_sync', 'Supplier catalog synchronization failed', {
        supplierId: supplier.id,
        supplierSlug: supplier.slug,
        error: message,
      });
    }
  }

  const summary = {
    requestedSupplierId: options.supplierId || null,
    processed: results.length,
    succeeded: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
  await logger(summary.failed ? 'WARN' : 'INFO', 'supplier_sync', 'Supplier catalog synchronization finished', summary);
  return summary;
}
