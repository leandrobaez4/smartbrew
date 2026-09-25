'use server';

import { revalidatePath } from 'next/cache';
import { portalDb, requireAdmin } from '@/lib/portal';

export async function markAlertRead(alertId: string) {
  await requireAdmin();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(alertId)) throw new Error('Identificador de alerta inválido.');
  await portalDb.alert.update({ where: { id: alertId }, data: { readAt: new Date() } });
  revalidatePath('/dashboard/alerts');
}
