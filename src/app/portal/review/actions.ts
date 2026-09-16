'use server';
import { redirect } from 'next/navigation';
import { portalDb, startPortalSession } from '@/lib/portal';
import { hashSecret } from '@/lib/portal-crypto';

export async function enterMetaReview(_state: { error: string }, form: FormData) {
  const token = String(form.get('token') || '');
  const failure = { error: 'El enlace de revisión no es válido, venció o fue revocado. Solicitá uno nuevo al administrador.' };
  if (!/^[a-f0-9]{64}$/.test(token)) return failure;
  try {
    const member = await portalDb.portalMember.findUnique({ where: { reviewTokenHash: hashSecret(token) }, select: { id: true, disabled: true, reviewExpiresAt: true } });
    if (!member || member.disabled || !member.reviewExpiresAt || member.reviewExpiresAt <= new Date()) return failure;
    // Separate 24-hour session cookie. portalSession rechecks revocation and the
    // 60-day deadline on every request, including after a concurrent revocation.
    await startPortalSession(member.id, member.reviewExpiresAt);
  } catch { return { error: 'No se pudo iniciar la sesión. Intentá nuevamente.' }; }
  redirect('/portal/instagram');
}
