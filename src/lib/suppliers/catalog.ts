import { Prisma } from '@prisma/client';
import { portalDb } from '../portal';
import { SupplierProduct } from './connectors';

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function supplierProductData(product: SupplierProduct, syncedAt: Date) {
  if (!product.externalId.trim()) throw new Error('Supplier product externalId is required');
  if (!product.title.trim()) throw new Error('Supplier product title is required');
  if (product.rawData === undefined) throw new Error('Supplier product rawData is required');

  return {
    externalId: product.externalId.trim(),
    sku: product.sku?.trim() || null,
    ean: product.ean?.trim() || null,
    title: product.title.trim(),
    description: product.description?.trim() || null,
    brand: product.brand?.trim() || null,
    category: product.category?.trim() || null,
    cost: product.cost == null ? null : new Prisma.Decimal(product.cost),
    currency: product.currency?.trim() || null,
    stock: product.stock ?? null,
    images: product.images || [],
    attributes: product.attributes == null ? Prisma.JsonNull : json(product.attributes),
    rawData: json(product.rawData),
    active: true,
    lastSyncAt: syncedAt,
  };
}

export async function importSupplierProducts(supplierId: string, products: SupplierProduct[], syncedAt = new Date()) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(supplierId)) throw new Error('Invalid supplier id');
  const uniqueProducts = new Map<string, ReturnType<typeof supplierProductData>>();
  for (const product of products) {
    const data = supplierProductData(product, syncedAt);
    uniqueProducts.set(data.externalId, data);
  }

  const incoming = [...uniqueProducts.values()];
  const existingProducts = incoming.length ? await portalDb.supplierProduct.findMany({
    where: { supplierId, externalId: { in: incoming.map((product) => product.externalId) } },
    select: { id: true, externalId: true, cost: true, stock: true },
  }) : [];
  const existingByExternalId = new Map(existingProducts.map((product) => [product.externalId, product]));
  const historyOperations = incoming.flatMap((data) => {
    const previous = existingByExternalId.get(data.externalId);
    if (!previous) return [];
    const previousCost = previous.cost == null ? null : Number(previous.cost);
    const nextCost = data.cost == null ? null : Number(data.cost);
    if (previousCost === nextCost && previous.stock === data.stock) return [];
    return [portalDb.supplierProductHistory.create({
      data: {
        supplierProductId: previous.id,
        cost: data.cost,
        stock: data.stock,
        createdAt: syncedAt,
      },
    })];
  });

  await portalDb.$transaction(
    [...historyOperations, ...incoming.map((data) => portalDb.supplierProduct.upsert({
      where: { supplierId_externalId: { supplierId, externalId: data.externalId } },
      create: { supplierId, ...data },
      update: data,
    }))],
  );
  await portalDb.supplier.update({ where: { id: supplierId }, data: { lastSyncAt: syncedAt } });
  return { imported: uniqueProducts.size, historyCreated: historyOperations.length, syncedAt };
}
