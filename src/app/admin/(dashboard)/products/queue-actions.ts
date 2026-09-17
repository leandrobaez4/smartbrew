'use server';
import { requireAdmin } from '@/lib/portal';
import { enqueueProductPublish } from '@/lib/queue/product-publish';
import { revalidatePath } from 'next/cache';

export async function enqueueInstagramProductsAction(ids: string[]) {
  await requireAdmin();
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || ids.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id))) return { success: false, message: 'Seleccioná entre 1 y 20 productos.' };
  const outcomes = await Promise.allSettled([...new Set(ids)].map(enqueueProductPublish));
  const queued = outcomes.filter(outcome => outcome.status === 'fulfilled').length;
  const errors = outcomes.flatMap((outcome, index) => outcome.status === 'rejected' ? [`${[...new Set(ids)][index]}: ${outcome.reason instanceof Error && !outcome.reason.name.includes('Prisma') ? outcome.reason.message : 'No se pudo encolar.'}`] : []);
  revalidatePath('/admin/products');
  return { success: !errors.length, message: `${queued} producto(s) encolado(s) o ya en curso. Podés cerrar la pantalla. ${errors.join(' ')}` };
}
