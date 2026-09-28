'use server';

import { Prisma, SupplierIntegrationType, SupplierStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { decodeElitImportPayload } from '@/lib/elit-import';
import { portalDb, requireAdmin } from '@/lib/portal';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from '@/lib/supplier-product-pricing';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function importElitProductAction(payload: string, formData: FormData) {
  await requireAdmin();
  const product = decodeElitImportPayload(payload);
  if (!product) redirect('/admin/suppliers/elit-import?error=payload');
  const parsed = SupplierProductPricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/suppliers/elit-import?payload=${encodeURIComponent(payload)}&error=pricing`);
  const pricing = calculateSupplierProductPricing(parsed.data);
  const syncedAt = new Date();

  const saved = await portalDb.$transaction(async (tx) => {
    const supplier = await tx.supplier.upsert({
      where: { slug: 'elit' },
      create: {
        name: 'Elit', slug: 'elit', website: 'https://www.elit.com.ar', type: 'elit',
        integrationType: SupplierIntegrationType.SCRAPING, status: SupplierStatus.ACTIVE, lastSyncAt: syncedAt,
      },
      update: { lastSyncAt: syncedAt },
    });
    const existing = await tx.supplierProduct.findUnique({
      where: { supplierId_externalId: { supplierId: supplier.id, externalId: product.externalId } },
      select: { id: true, cost: true, stock: true },
    });
    const data = {
      sku: product.sku,
      ean: product.ean,
      title: product.title,
      description: product.description,
      brand: product.brand,
      category: product.category,
      cost: pricing.supplierCostWithTaxesArs,
      currency: 'ARS',
      stock: product.stock,
      images: product.images,
      attributes: json(product.attributes),
      rawData: json({ ...product.rawData, sourceUrl: product.sourceUrl, capturedPricing: product.pricing }),
      active: true,
      lastSyncAt: syncedAt,
    };
    const supplierProduct = await tx.supplierProduct.upsert({
      where: { supplierId_externalId: { supplierId: supplier.id, externalId: product.externalId } },
      create: { supplierId: supplier.id, externalId: product.externalId, ...data },
      update: data,
    });
    if (existing && (Number(existing.cost) !== pricing.supplierCostWithTaxesArs || existing.stock !== product.stock)) {
      await tx.supplierProductHistory.create({ data: {
        supplierProductId: existing.id,
        cost: pricing.supplierCostWithTaxesArs,
        stock: product.stock,
        supplierCurrency: pricing.supplierCurrency,
        supplierPriceUsd: pricing.supplierPriceUsd,
        exchangeRateArsPerUsd: pricing.exchangeRateArsPerUsd,
        vatPercentage: pricing.vatPercentage,
        internalTaxAmountArs: pricing.internalTaxAmountArs,
        supplierCostWithTaxesArs: pricing.supplierCostWithTaxesArs,
        createdAt: syncedAt,
      } });
    }
    await tx.supplierProductPricing.upsert({
      where: { supplierProductId: supplierProduct.id },
      create: { supplierProductId: supplierProduct.id, ...pricing, supplierPricingUpdatedAt: syncedAt },
      update: { ...pricing, supplierPricingUpdatedAt: syncedAt, marketplaceFeeSyncedAt: null },
    });
    return supplierProduct;
  });
  redirect(`/admin/opportunities/${saved.id}?imported=1`);
}
