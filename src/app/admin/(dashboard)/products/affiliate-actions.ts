'use server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/portal';

const prisma = new PrismaClient();

export async function updateAffiliateUrlAction(productId: string, formData: FormData) {
  try {
    await requireAdmin();
    const value = formData.get('affiliateUrl');
    if (!productId || productId.length > 128 || typeof value !== 'string' || value.length > 4096 || formData.get('confirmed') !== 'on') {
      return { success: false, message: 'Ingresá un enlace válido y confirmá su origen.' };
    }
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      return { success: false, message: 'El enlace debe ser una URL HTTP o HTTPS sin credenciales.' };
    }
    await prisma.product.update({ where: { id: productId }, data: { affiliateUrl: url.href, status: 'ACTIVE' } });
    revalidatePath('/admin/products');
    revalidatePath(`/admin/products/${productId}`);
    return { success: true, message: 'Enlace guardado y producto activado.' };
  } catch {
    return { success: false, message: 'No se pudo guardar el enlace. Verificá los datos y tu sesión.' };
  }
}
