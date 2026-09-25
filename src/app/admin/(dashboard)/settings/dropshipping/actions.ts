'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { parseDropshippingSettings, saveDropshippingSettings } from '@/lib/dropshipping-settings';
import { requireAdmin } from '@/lib/portal';

export async function updateDropshippingSettingsAction(formData: FormData) {
  await requireAdmin();
  const parsed = parseDropshippingSettings(formData);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Revisá la configuración.';
    redirect(`/admin/settings/dropshipping?error=${encodeURIComponent(message)}`);
  }
  await saveDropshippingSettings(parsed.data);
  revalidatePath('/admin/settings/dropshipping');
  redirect('/admin/settings/dropshipping?saved=1');
}
