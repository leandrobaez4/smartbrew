'use server';

import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { decodeElitImportPayload } from '@/lib/elit-import';
import { portalDb, requireAdmin } from '@/lib/portal';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from '@/lib/supplier-product-pricing';
import { importSupplierProducts } from '@/lib/suppliers/catalog';
import { supplierConnectorConfig, supplierConnectorFactory } from '@/lib/suppliers/sync';

export async function importElitProductAction(payload: string, formData: FormData) {
  await requireAdmin();
  const product = decodeElitImportPayload(payload);
  if (!product) redirect('/admin/suppliers/elit-import?error=payload');
  const parsed = SupplierProductPricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/suppliers/elit-import?payload=${encodeURIComponent(payload)}&error=pricing`);
  const pricing = calculateSupplierProductPricing(parsed.data);
  const syncedAt = new Date();

  const supplier = await portalDb.supplier.upsert({
    where: { slug: 'elit' },
    create: {
      name: 'Elit', slug: 'elit', website: 'https://www.elit.com.ar', type: 'elit-snapshot-v1',
      integrationType: SupplierIntegrationType.SCRAPING, status: SupplierStatus.ACTIVE, lastSyncAt: syncedAt,
    },
    update: { type: 'elit-snapshot-v1', lastSyncAt: syncedAt },
  });
  const connector = supplierConnectorFactory.make({
    ...supplierConnectorConfig(supplier),
    connectorKey: 'elit-snapshot-v1',
    sourceSnapshot: product,
    normalizedCostArs: pricing.supplierCostWithTaxesArs,
    normalizedPricing: {
      supplierCurrency: pricing.supplierCurrency,
      supplierPriceUsd: pricing.supplierPriceUsd,
      exchangeRateArsPerUsd: pricing.exchangeRateArsPerUsd,
      vatPercentage: pricing.vatPercentage,
      internalTaxAmountArs: pricing.internalTaxAmountArs,
      supplierCostWithTaxesArs: pricing.supplierCostWithTaxesArs,
    },
  });
  const normalized = await connector.getProduct(product.externalId);
  if (!normalized) throw new Error('El conector de Elit no devolvió el producto solicitado.');
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
