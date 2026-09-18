'use server';

import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/portal';
import { mergeProductImages } from '../../../../lib/product-gallery';

const db = new PrismaClient();

export async function removeProductImageAction(productId: string, imageUrl: string) {
  try {
    await requireAdmin();
    if (typeof productId !== 'string' || !/^[\w-]{1,128}$/.test(productId) || typeof imageUrl !== 'string' || !imageUrl || imageUrl.length > 4096) {
      return { success: false, message: 'Imagen o producto inválido.' };
    }
    const result = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${productId} FOR UPDATE`;
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) return { success: false, message: 'Producto no encontrado.' };
      const job = await tx.jobExecution.findFirst({ where: { entityId: productId, jobName: { in: ['instagram_product_publish', 'meta_paused_ad'] }, status: 'STARTED' } });
      const publication = await tx.publication.findFirst({ where: { draft: { productId }, platform: 'INSTAGRAM', deletedAt: null, status: { in: ['QUEUED', 'UPLOADING', 'PROCESSING'] } } });
      if (job || publication) return { success: false, message: 'Hay una publicación o anuncio en cola/procesando. Esperá a que termine antes de cambiar las imágenes.' };
      const images = mergeProductImages(product.primaryImageUrl ? [product.primaryImageUrl] : [], product.imageUrls);
      if (!images.includes(imageUrl)) return { success: false, message: 'La imagen ya no está en la galería. Actualizá la página.' };
      const remaining = images.filter(image => image !== imageUrl);
      await tx.product.update({ where: { id: productId }, data: { primaryImageUrl: remaining[0] ?? null, imageUrls: remaining } });
      return { success: true, message: 'Imagen eliminada de SmartBrew. Las publicaciones existentes en Instagram no cambian.' };
    });
    if (result.success) {
      revalidatePath('/admin/products');
      revalidatePath(`/admin/products/${productId}`);
      revalidatePath('/productos');
      revalidatePath(`/productos/${productId}`);
    }
    return result;
  } catch {
    return { success: false, message: 'No se pudo eliminar la imagen. Revisá tu sesión e intentá nuevamente.' };
  }
}
