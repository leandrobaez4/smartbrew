'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { portalDb, requireAdmin } from '@/lib/portal';
import { hashSecret, randomSecret } from '@/lib/portal-crypto';
import { portalEmailConfig, sendPortalInvitation } from '@/lib/portal-email';

export async function inviteMember(_state: { message: string; code?: string }, form: FormData) {
  await requireAdmin();
  const email = z.string().email().max(254).safeParse(String(form.get('email') || '').trim().toLowerCase());
  if (!email.success) return { message: 'Ingresá un correo válido.' };
  try { portalEmailConfig(); } catch { return { message: 'Falta configurar RESEND_API_KEY y PORTAL_EMAIL_FROM en Vercel. No se creó ni modificó ninguna invitación.' }; }
  const code = randomSecret();
  const inviteHash = hashSecret(code);
  try {
    const existing = await portalDb.portalMember.findUnique({ where: { email: email.data }, select: { id: true, disabled: true, passwordHash: true, inviteHash: true } });
    const data = { inviteHash, inviteExpiresAt: new Date(Date.now() + 7 * 86400000) };
    if (existing) {
      if (existing.disabled) {
        await portalDb.$transaction(async tx => {
          const updated = await tx.portalMember.updateMany({ where: { id: existing.id, disabled: true }, data: { ...data, disabled: false, passwordHash: null, loginAttempts: 0, loginWindowEnd: null } });
          if (!updated.count) throw new Error('Member changed');
          await tx.portalSession.deleteMany({ where: { memberId: existing.id } });
          await tx.instagramConnection.deleteMany({ where: { memberId: existing.id } });
        });
      } else {
        if (existing.passwordHash) return { message: 'Este usuario ya activó su acceso. No se envió otra invitación.' };
        const updated = await portalDb.portalMember.updateMany({ where: { id: existing.id, disabled: false, passwordHash: null, inviteHash: existing.inviteHash }, data });
        if (!updated.count) return { message: 'La invitación cambió. Actualizá la página antes de intentar nuevamente.' };
      }
    } else await portalDb.portalMember.create({ data: { email: email.data, ...data } });
  } catch { return { message: 'No se pudo guardar la invitación. Actualizá la página y volvé a intentar.' }; }
  revalidatePath('/admin/instagram');
  try {
    await sendPortalInvitation(email.data, code, inviteHash);
    return { message: 'Resend aceptó el email para envío. El código vence en 7 días. Revisá la bandeja de entrada y spam; la aceptación no confirma la entrega.' };
  } catch {
    return { message: 'La invitación quedó guardada, pero no pudimos confirmar el envío. Podés compartir este código por un canal privado o volver a enviar (se invalidará el código anterior).', code };
  }
}

export async function revokeMember(form: FormData) {
  await requireAdmin();
  const id = String(form.get('memberId'));
  await portalDb.$transaction([
    portalDb.portalMember.update({ where: { id }, data: { disabled: true, inviteHash: null, reviewTokenHash: null } }),
    portalDb.portalSession.deleteMany({ where: { memberId: id } }),
    portalDb.instagramConnection.deleteMany({ where: { memberId: id } }),
  ]);
  revalidatePath('/admin/instagram');
}

export async function createMetaReviewAccess(_state: { message: string; token?: string; expiresAt?: string }, form: FormData) {
  await requireAdmin();
  if (form.get('confirmed') !== 'on') return { message: 'Confirmá que este acceso es exclusivamente para la revisión de Meta.' };
  const token = randomSecret();
  const expiresAt = new Date(Date.now() + 60 * 86400000);
  try {
    await portalDb.portalMember.create({ data: {
      // Reserved non-deliverable identifier; no email is sent or Meta identity implied.
      email: `meta-review-${randomSecret()}@review.invalid`,
      reviewTokenHash: hashSecret(token), reviewExpiresAt: expiresAt,
    } });
  } catch { return { message: 'No se pudo crear el acceso de revisión. Revisá que la migración esté aplicada.' }; }
  revalidatePath('/admin/instagram');
  return { message: 'Acceso creado. Guardá el enlace privado: se muestra solo ahora. No otorga permisos administrativos.', token, expiresAt: expiresAt.toISOString() };
}
