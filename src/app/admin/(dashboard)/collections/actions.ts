'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseCollectionFormData } from '@/lib/collection-form';
import { MoveDirection, reorderedProductIds } from '@/lib/collection-order';
import { portalDb, requireAdmin } from '@/lib/portal';

const validId = (value: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(value);

function collectionPath(id?: string, message?: string) {
  const base = id ? `/admin/collections/${id}` : '/admin/collections/new';
  return message ? `${base}?error=${encodeURIComponent(message)}` : base;
}

function firstValidationError(result: ReturnType<typeof parseCollectionFormData>) {
  if (result.success) return null;
  return result.error.issues[0]?.message || 'Revisá los datos de la colección.';
}

function databaseMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return 'Ya existe una colección con ese slug.';
  }
  return 'No se pudo guardar la colección.';
}

export async function createCollectionAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseCollectionFormData(formData);
  const validationError = firstValidationError(parsed);
  if (validationError || !parsed.success) redirect(collectionPath(undefined, validationError || undefined));

  let destination: string;
  try {
    const collection = await portalDb.collection.create({ data: parsed.data });
    revalidatePath('/admin/collections');
    destination = `/admin/collections/${collection.id}?saved=1`;
  } catch (error) {
    destination = collectionPath(undefined, databaseMessage(error));
  }
  redirect(destination);
}

export async function updateCollectionAction(id: string, formData: FormData) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/collections');
  const parsed = parseCollectionFormData(formData);
  const validationError = firstValidationError(parsed);
  if (validationError || !parsed.success) redirect(collectionPath(id, validationError || undefined));

  let destination: string;
  try {
    await portalDb.collection.update({ where: { id }, data: parsed.data });
    revalidatePath('/admin/collections');
    revalidatePath(`/admin/collections/${id}`);
    destination = `/admin/collections/${id}?saved=1`;
  } catch (error) {
    destination = collectionPath(id, databaseMessage(error));
  }
  redirect(destination);
}

export async function setCollectionPublishedAction(id: string, published: boolean) {
  await requireAdmin();
  if (!validId(id) || typeof published !== 'boolean') return;
  await portalDb.collection.update({ where: { id }, data: { published } });
  revalidatePath('/admin/collections');
  revalidatePath(`/admin/collections/${id}`);
}

export async function deleteCollectionAction(id: string) {
  await requireAdmin();
  if (!validId(id)) redirect('/admin/collections');
  await portalDb.collection.delete({ where: { id } });
  revalidatePath('/admin/collections');
  redirect('/admin/collections');
}

export async function addCollectionProductAction(collectionId: string, formData: FormData) {
  await requireAdmin();
  const productId = String(formData.get('productId') || '');
  if (!validId(collectionId) || !validId(productId)) return;

  await portalDb.$transaction(async (tx) => {
    const [collection, product, existing, last] = await Promise.all([
      tx.collection.findUnique({ where: { id: collectionId }, select: { id: true } }),
      tx.product.findUnique({ where: { id: productId }, select: { id: true } }),
      tx.collectionProduct.findUnique({ where: { collectionId_productId: { collectionId, productId } }, select: { productId: true } }),
      tx.collectionProduct.findFirst({ where: { collectionId }, orderBy: { position: 'desc' }, select: { position: true } }),
    ]);
    if (!collection || !product || existing) return;
    await tx.collectionProduct.create({ data: { collectionId, productId, position: (last?.position ?? -1) + 1 } });
  });
  revalidatePath(`/admin/collections/${collectionId}`);
}

export async function removeCollectionProductAction(collectionId: string, productId: string) {
  await requireAdmin();
  if (!validId(collectionId) || !validId(productId)) return;

  await portalDb.$transaction(async (tx) => {
    await tx.collectionProduct.deleteMany({ where: { collectionId, productId } });
    const remaining = await tx.collectionProduct.findMany({ where: { collectionId }, orderBy: { position: 'asc' }, select: { productId: true } });
    for (const [position, item] of remaining.entries()) {
      await tx.collectionProduct.update({
        where: { collectionId_productId: { collectionId, productId: item.productId } },
        data: { position },
      });
    }
  });
  revalidatePath(`/admin/collections/${collectionId}`);
}

export async function moveCollectionProductAction(collectionId: string, productId: string, direction: MoveDirection) {
  await requireAdmin();
  if (!validId(collectionId) || !validId(productId) || !['up', 'down'].includes(direction)) return;

  await portalDb.$transaction(async (tx) => {
    const items = await tx.collectionProduct.findMany({ where: { collectionId }, orderBy: { position: 'asc' }, select: { productId: true } });
    const currentIds = items.map((item) => item.productId);
    const nextIds = reorderedProductIds(currentIds, productId, direction);
    if (nextIds.every((id, index) => id === currentIds[index])) return;

    // Move all positions out of the unique-index range before assigning the new order.
    await tx.collectionProduct.updateMany({ where: { collectionId }, data: { position: { increment: nextIds.length } } });
    for (const [position, id] of nextIds.entries()) {
      await tx.collectionProduct.update({
        where: { collectionId_productId: { collectionId, productId: id } },
        data: { position },
      });
    }
  });
  revalidatePath(`/admin/collections/${collectionId}`);
}
