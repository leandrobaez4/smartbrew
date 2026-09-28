'use server';

import { Prisma, SupplierProductEditorialStatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { portalDb, requireAdmin } from '@/lib/portal';
import { calculateSupplierProductPricing, SupplierProductPricingSchema } from '@/lib/supplier-product-pricing';
import {
  generateAndSaveSupplierProductEditorial,
  SupplierProductEditorialSchema,
} from '@/lib/supplier-product-editorial';

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const lines = (value: FormDataEntryValue | null) => String(value || '')
  .split('\n')
  .map((item) => item.trim())
  .filter(Boolean);

function path(id: string, key: 'saved' | 'generated' | 'error') {
  return `/admin/opportunities/${id}?${key}=1`;
}

export async function generateSupplierEditorialAction(id: string) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/opportunities');
  try {
    await generateAndSaveSupplierProductEditorial(id, portalDb);
  } catch {
    redirect(path(id, 'error'));
  }
  revalidatePath('/admin/opportunities');
  revalidatePath(`/admin/opportunities/${id}`);
  redirect(path(id, 'generated'));
}

export async function approveSupplierEditorialAction(id: string, formData: FormData) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/opportunities');
  const parsed = SupplierProductEditorialSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    bulletPoints: lines(formData.get('bulletPoints')),
    productHighlights: lines(formData.get('productHighlights')),
    seoKeywords: lines(formData.get('seoKeywords')),
  });
  if (!parsed.success) redirect(path(id, 'error'));
  await portalDb.supplierProduct.update({
    where: { id },
    data: {
      editorialTitle: parsed.data.title,
      editorialDescription: parsed.data.description,
      editorialBulletPoints: parsed.data.bulletPoints as Prisma.InputJsonValue,
      editorialHighlights: parsed.data.productHighlights as Prisma.InputJsonValue,
      editorialSeoKeywords: parsed.data.seoKeywords,
      editorialStatus: SupplierProductEditorialStatus.APPROVED,
      editorialError: null,
      editorialReviewedAt: new Date(),
    },
  });
  revalidatePath('/admin/opportunities');
  revalidatePath(`/admin/opportunities/${id}`);
  redirect(path(id, 'saved'));
}

export async function updateSupplierProductPricingAction(id: string, formData: FormData) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/opportunities');
  const parsed = SupplierProductPricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(path(id, 'error'));
  const pricing = calculateSupplierProductPricing(parsed.data);
  const updatedAt = new Date();
  await portalDb.$transaction(async (tx) => {
    const current = await tx.supplierProduct.findUnique({
      where: { id },
      select: { cost: true, stock: true, pricing: { select: {
        supplierPriceUsd: true,
        exchangeRateArsPerUsd: true,
        vatPercentage: true,
        internalTaxAmountArs: true,
      } } },
    });
    await tx.supplierProduct.update({ where: { id }, data: { cost: pricing.supplierCostWithTaxesArs, currency: 'ARS' } });
    await tx.supplierProductPricing.upsert({
      where: { supplierProductId: id },
      create: { supplierProductId: id, ...pricing, supplierPricingUpdatedAt: updatedAt },
      update: { ...pricing, supplierPricingUpdatedAt: updatedAt, marketplaceFeeSyncedAt: null },
    });
    const changed = !current?.pricing
      || Number(current.pricing.supplierPriceUsd) !== pricing.supplierPriceUsd
      || Number(current.pricing.exchangeRateArsPerUsd) !== pricing.exchangeRateArsPerUsd
      || Number(current.pricing.vatPercentage) !== pricing.vatPercentage
      || Number(current.pricing.internalTaxAmountArs) !== pricing.internalTaxAmountArs;
    if (changed) {
      await tx.supplierProductHistory.create({ data: {
        supplierProductId: id,
        cost: pricing.supplierCostWithTaxesArs,
        stock: current?.stock,
        supplierCurrency: pricing.supplierCurrency,
        supplierPriceUsd: pricing.supplierPriceUsd,
        exchangeRateArsPerUsd: pricing.exchangeRateArsPerUsd,
        vatPercentage: pricing.vatPercentage,
        internalTaxAmountArs: pricing.internalTaxAmountArs,
        supplierCostWithTaxesArs: pricing.supplierCostWithTaxesArs,
        createdAt: updatedAt,
      } });
    }
  });
  revalidatePath('/admin/opportunities');
  revalidatePath(`/admin/opportunities/${id}`);
  redirect(`/admin/opportunities/${id}?pricingSaved=1`);
}
