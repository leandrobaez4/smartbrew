'use server';

import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { decodeUnidropImportPayload } from '@/lib/unidrop-import';
import { portalDb, requireAdmin } from '@/lib/portal';
import { importSupplierProducts } from '@/lib/suppliers/catalog';
import { supplierConnectorConfig, supplierConnectorFactory } from '@/lib/suppliers/sync';

export async function importSupplierSnapshotAction(payload: string) {
  await requireAdmin();
  const product = decodeUnidropImportPayload(payload);
  if (!product) redirect('/admin/suppliers/import?error=payload');
  const syncedAt = new Date();
  const supplier = await portalDb.supplier.upsert({
    where: { slug: 'unidrop' },
    create: {
      name: 'Unidrop',
      slug: 'unidrop',
      website: 'https://www.unidrop.com.ar',
      type: 'unidrop-snapshot-v1',
      integrationType: SupplierIntegrationType.SCRAPING,
      status: SupplierStatus.ACTIVE,
      lastSyncAt: syncedAt,
    },
    update: {
      name: 'Unidrop',
      website: 'https://www.unidrop.com.ar',
      type: 'unidrop-snapshot-v1',
      integrationType: SupplierIntegrationType.SCRAPING,
      status: SupplierStatus.ACTIVE,
      lastSyncAt: syncedAt,
    },
  });
  const connector = supplierConnectorFactory.make({
    ...supplierConnectorConfig(supplier),
    connectorKey: 'unidrop-snapshot-v1',
    sourceSnapshot: product,
  });
  const normalized = await connector.getProduct(product.externalId);
  if (!normalized) throw new Error('El conector de Unidrop no devolvió el producto solicitado.');
  await importSupplierProducts(supplier.id, [normalized], syncedAt);
  const supplierProduct = await portalDb.supplierProduct.findUniqueOrThrow({
    where: { supplierId_externalId: { supplierId: supplier.id, externalId: product.externalId } },
  });
  redirect(`/admin/opportunities/${supplierProduct.id}?imported=1`);
}
