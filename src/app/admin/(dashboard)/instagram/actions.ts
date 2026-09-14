'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { portalDb, requireAdmin } from '@/lib/portal';
import { hashSecret, randomSecret } from '@/lib/portal-crypto';

export async function inviteMember(_state: { message: string; code?: string }, form: FormData) {
  await requireAdmin();
  const email = z.string().email().max(254).safeParse(String(form.get('email') || '').trim().toLowerCase());
  if (!email.success) return { message: 'Ingresá un correo válido.' };
  const code = randomSecret();
  try {
    await portalDb.portalMember.create({ data: { email: email.data, inviteHash: hashSecret(code), inviteExpiresAt: new Date(Date.now() + 7 * 86400000) } });
  } catch { return { message: 'No se pudo crear. Revisá si el correo ya está invitado.' }; }
  revalidatePath('/admin/instagram');
  return { message: 'Compartí el código de forma privada. Se muestra solo ahora y vence en 7 días. No se envió ningún email.', code };
}

export async function revokeMember(form: FormData) {
  await requireAdmin();
  const id = String(form.get('memberId'));
  await portalDb.$transaction([
    portalDb.portalMember.update({ where: { id }, data: { disabled: true, inviteHash: null } }),
    portalDb.portalSession.deleteMany({ where: { memberId: id } }),
    portalDb.instagramConnection.deleteMany({ where: { memberId: id } }),
  ]);
  revalidatePath('/admin/instagram');
}
