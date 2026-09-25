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
  return `/dashboard/opportunities/${id}?${key}=1`;
}

export async function generateSupplierEditorialAction(id: string) {
  await requireAdmin();
  if (!validId(id)) redirect('/dashboard/opportunities');
  try {
    await generateAndSaveSupplierProductEditorial(id, portalDb);
  } catch {
    redirect(path(id, 'error'));
  }
  revalidatePath('/dashboard/opportunities');
  revalidatePath(`/dashboard/opportunities/${id}`);
  redirect(path(id, 'generated'));
}

export async function approveSupplierEditorialAction(id: string, formData: FormData) {
  await requireAdmin();
  if (!validId(id)) redirect('/dashboard/opportunities');
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
  revalidatePath('/dashboard/opportunities');
  revalidatePath(`/dashboard/opportunities/${id}`);
  redirect(path(id, 'saved'));
}

export async function updateSupplierProductPricingAction(id: string, formData: FormData) {
  await requireAdmin();
  if (!validId(id)) redirect('/dashboard/opportunities');
  const parsed = SupplierProductPricingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(path(id, 'error'));
  const pricing = calculateSupplierProductPricing(parsed.data);
  await portalDb.$transaction([
    portalDb.supplierProduct.update({ where: { id }, data: { cost: pricing.supplierCostWithVatArs, currency: 'ARS' } }),
    portalDb.supplierProductPricing.upsert({
      where: { supplierProductId: id },
      create: { supplierProductId: id, ...pricing },
      update: { ...pricing, marketplaceFeeSyncedAt: null },
    }),
  ]);
  revalidatePath('/dashboard/opportunities');
  revalidatePath(`/dashboard/opportunities/${id}`);
  redirect(`/dashboard/opportunities/${id}?pricingSaved=1`);
}
