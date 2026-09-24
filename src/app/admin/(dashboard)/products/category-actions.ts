'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/portal';
import { generateProductEditorial, stringAttributes } from '../../../../lib/product-editorial';
import { getProductCategory } from '../../../../lib/product-categories';

const db = new PrismaClient();
export async function recalculateProductCategory(productId: string) {
  try {
    await requireAdmin();
    if (typeof productId !== 'string' || !/^[\w-]{1,128}$/.test(productId)) return { success: false, message: 'Producto inválido.' };
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return { success: false, message: 'Producto no encontrado.' };
    if (product.aiStatus === 'PROCESSING') return { success: false, message: 'Ya se está generando el contenido con IA. Esperá a que termine.' };
    const attributes = stringAttributes(product.attributesJson);
    const editorial = await generateProductEditorial({
      title: product.originalTitle || product.title,
      ...(product.originalDescription ? { description: product.originalDescription } : {}),
      ...(attributes ? { attributes } : {}),
      ...(product.categoryId ? { category: product.categoryId } : {}),
      ...(attributes?.BRAND ? { brand: attributes.BRAND } : {}),
      ...(attributes?.MODEL ? { model: attributes.MODEL } : {}),
    });
    const category = getProductCategory(editorial.suggestedCategory);
    if (!category) return { success: false, message: 'La IA no devolvió una categoría válida.' };
    // Compare-and-swap: a slow generation must not overwrite concurrent edits.
    const result = await db.product.updateMany({ where: { id: productId, updatedAt: product.updatedAt }, data: { category: category.slug } });
    if (!result.count) return { success: false, message: 'El producto cambió durante el cálculo. Actualizá y volvé a intentar.' };
    for (const path of ['/admin/products', `/admin/products/${productId}`, '/productos', `/productos/${productId}`, '/']) revalidatePath(path);
    return { success: true, message: `Categoría actualizada: ${category.name}.` };
  } catch {
    return { success: false, message: 'No se pudo calcular la categoría. Revisá tu sesión y la configuración de IA. Se conservó la categoría anterior si no se llegó a guardar.' };
  }
}
