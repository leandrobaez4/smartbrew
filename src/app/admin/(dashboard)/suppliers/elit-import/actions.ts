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
      cost: pricing.supplierCostWithVatArs,
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
    if (existing && (Number(existing.cost) !== pricing.supplierCostWithVatArs || existing.stock !== product.stock)) {
      await tx.supplierProductHistory.create({ data: { supplierProductId: existing.id, cost: pricing.supplierCostWithVatArs, stock: product.stock, createdAt: syncedAt } });
    }
    await tx.supplierProductPricing.upsert({
      where: { supplierProductId: supplierProduct.id },
      create: { supplierProductId: supplierProduct.id, ...pricing },
      update: { ...pricing, marketplaceFeeSyncedAt: null },
    });
    return supplierProduct;
  });
  redirect(`/dashboard/opportunities/${saved.id}?imported=1`);
}
