'use server';

import { SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from '@/lib/supplier-product-pricing';
import { importSupplierProducts } from '@/lib/suppliers/catalog';
import { ElitApiConnector } from '@/lib/suppliers/elit-api';
import { supplierConnectorConfig } from '@/lib/suppliers/sync';

export async function importElitSearchProductAction(externalId: string, formData: FormData) {
  await requireAdmin();
  if (!/^\d{1,12}$/.test(externalId)) redirect('/admin/suppliers/elit-search?error=product');
  const parsed = SupplierProductPricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/suppliers/elit-search?id=${externalId}&error=pricing`);

  const supplier = await portalDb.supplier.findUnique({ where: { slug: 'elit' } });
  if (!supplier?.usernameEncrypted || !supplier.apiKeyEncrypted) redirect('/admin/suppliers/elit-search');
  const connector = new ElitApiConnector(supplierConnectorConfig(supplier));
  const product = await connector.getProduct(externalId);
  if (!product) redirect('/admin/suppliers/elit-search?error=product');

  const pricing = calculateSupplierProductPricing(parsed.data);
  const syncedAt = new Date();
  await importSupplierProducts(supplier.id, [{ ...product, cost: pricing.supplierCostWithTaxesArs, pricing: {
    ...product.pricing,
    supplierCurrency: pricing.supplierCurrency,
    supplierPriceUsd: pricing.supplierPriceUsd,
    exchangeRateArsPerUsd: pricing.exchangeRateArsPerUsd,
    vatPercentage: pricing.vatPercentage,
    internalTaxAmountArs: pricing.internalTaxAmountArs,
    supplierCostWithTaxesArs: pricing.supplierCostWithTaxesArs,
  } }], syncedAt);
  const saved = await portalDb.supplierProduct.findUniqueOrThrow({
    where: { supplierId_externalId: { supplierId: supplier.id, externalId } },
  });
  await portalDb.supplierProductPricing.upsert({
    where: { supplierProductId: saved.id },
    create: { supplierProductId: saved.id, ...pricing, supplierPricingUpdatedAt: syncedAt },
    update: { ...pricing, supplierPricingUpdatedAt: syncedAt, marketplaceFeeSyncedAt: null },
  });
  await portalDb.supplier.update({ where: { id: supplier.id }, data: { type: 'elit-v1', integrationType: SupplierIntegrationType.API, status: SupplierStatus.ACTIVE } });
  redirect(`/admin/opportunities/${saved.id}?imported=1`);
}
