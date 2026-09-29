'use server';

import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { decodeUnidropImportPayload } from '@/lib/unidrop-import';
import { portalDb, requireAdmin } from '@/lib/portal';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from '@/lib/supplier-product-pricing';
import { importSupplierProducts } from '@/lib/suppliers/catalog';
import { supplierConnectorConfig, supplierConnectorFactory } from '@/lib/suppliers/sync';

export async function importSupplierSnapshotAction(payload: string, formData: FormData) {
  await requireAdmin();
  const product = decodeUnidropImportPayload(payload);
  if (!product) redirect('/admin/suppliers/import?error=payload');
  const parsed = SupplierProductPricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/suppliers/import?payload=${encodeURIComponent(payload)}&error=pricing`);
  const pricing = calculateSupplierProductPricing(parsed.data);
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
    normalizedCostArs: pricing.supplierCostWithTaxesArs,
    normalizedPricing: {
      supplierCurrency: pricing.supplierCurrency,
      supplierPriceUsd: pricing.supplierPriceUsd,
      exchangeRateArsPerUsd: pricing.exchangeRateArsPerUsd,
      vatPercentage: pricing.vatPercentage,
      internalTaxAmountArs: pricing.internalTaxAmountArs,
      supplierCostWithTaxesArs: pricing.supplierCostWithTaxesArs,
      supplierPvpUsd: pricing.supplierPvpUsd,
      supplierPvpArs: pricing.supplierPvpArs,
      supplierMarkupPercentage: pricing.supplierMarkupPercentage,
    },
  });
  const normalized = await connector.getProduct(product.externalId);
  if (!normalized) throw new Error('El conector de Unidrop no devolvió el producto solicitado.');
  await importSupplierProducts(supplier.id, [normalized], syncedAt);
  const supplierProduct = await portalDb.supplierProduct.findUniqueOrThrow({
    where: { supplierId_externalId: { supplierId: supplier.id, externalId: product.externalId } },
  });
  await portalDb.supplierProductPricing.upsert({
    where: { supplierProductId: supplierProduct.id },
    create: { supplierProductId: supplierProduct.id, ...pricing, supplierPricingUpdatedAt: syncedAt },
    update: { ...pricing, supplierPricingUpdatedAt: syncedAt, marketplaceFeeSyncedAt: null },
  });
  redirect(`/admin/opportunities/${supplierProduct.id}?imported=1`);
}
