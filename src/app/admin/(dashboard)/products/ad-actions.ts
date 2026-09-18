'use server';
import { requireAdmin } from '@/lib/portal';
import { enqueuePausedAd } from '@/lib/queue/meta-ads';
import { revalidatePath } from 'next/cache';
import { PrismaClient } from '@prisma/client';
import { adsConfig } from '@/lib/meta-ads';

const db = new PrismaClient();
export async function getProductAdState(productId: string) {
  await requireAdmin();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) throw Error('Producto inválido.');
  let enabled = false;
  try { adsConfig(); enabled = true; } catch { /* Return readiness, never credentials. */ }
  const job = await db.jobExecution.findFirst({ where: { jobName: 'meta_paused_ad', entityId: productId }, orderBy: { startedAt: 'desc' } });
  const output = job?.outputJson as Record<string, unknown> | null;
  const ids = Object.entries(output || {}).filter(([key, value]) => ['campaigns', 'adsets', 'adcreatives', 'ads'].includes(key) && typeof value === 'string' && /^\d+$/.test(value));
  return { enabled, job: job ? { id: job.id, status: job.status, interrupted: job.status === 'STARTED' && Date.now() - job.startedAt.getTime() > 180000, error: job.errorMessage, ids: ids.map(([key, value]) => `${key}: ${value}`) } : null };
}

export async function createProductAdAction(input: unknown) {
  await requireAdmin();
  try {
    const result = await enqueuePausedAd(input);
    revalidatePath('/admin/products');
    return { success: true, message: result.existing ? 'Ya existe un intento para este producto. Revisá su estado; no se creó otro.' : 'Creación encolada. El anuncio quedará PAUSADO, sin activar gasto.' };
  } catch {
    return { success: false, message: 'No se confirmó el encolado. Revisá configuración META_ADS, datos, QStash y el estado del intento antes de repetir.' };
  }
}
