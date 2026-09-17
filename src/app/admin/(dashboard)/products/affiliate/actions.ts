'use server';
import { requireAdmin } from '@/lib/portal';
import { saveOrQueueAffiliate } from '@/lib/affiliate-import';
import { revalidatePath } from 'next/cache';

export async function confirmAffiliateImport(_: { message: string }, form: FormData) {
  await requireAdmin();
  try {
    const expected = form.get('expectedLink');
    if (typeof expected !== 'string') throw Error('Formulario inválido.');
    if (expected && form.get('replace') !== 'on') throw Error('Confirmá el reemplazo del enlace existente.');
    const result = await saveOrQueueAffiliate({ url: form.get('url'), affiliateUrl: form.get('affiliateUrl'), title: form.get('title'), image: form.get('image') }, expected || null);
    revalidatePath('/admin/products');
    return { message: result.message };
  } catch (error) {
    return { message: error instanceof Error && !error.name.includes('Prisma') && error.name !== 'ZodError' ? error.message : 'No se pudo guardar. Revisá los datos e intentá nuevamente.' };
  }
}
