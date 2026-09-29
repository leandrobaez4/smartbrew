'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseDropshippingSettings, saveDropshippingSettings } from '@/lib/dropshipping-settings';
import { ensureDropshippingQStashSchedule } from '@/lib/dropshipping-jobs';
import { requireAdmin } from '@/lib/portal';

export async function updateDropshippingSettingsAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseDropshippingSettings(formData);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Revisá la configuración.';
    redirect(`/admin/settings/dropshipping?error=${encodeURIComponent(message)}`);
  }
  try {
    await ensureDropshippingQStashSchedule(parsed.data.supplierSyncInterval);
    await saveDropshippingSettings(parsed.data);
  } catch (error) {
    const message = error instanceof Error && (error.message.includes('Configurá QStash') || error.message.includes('APP_URL'))
      ? error.message
      : 'No se pudo crear o actualizar el scheduler de QStash.';
    redirect(`/admin/settings/dropshipping?error=${encodeURIComponent(message)}`);
  }
  revalidatePath('/admin/settings/dropshipping');
  redirect('/admin/settings/dropshipping?saved=1');
}
