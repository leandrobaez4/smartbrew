'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { portalDb, requirePortal, endPortalSession } from '@/lib/portal';
import { hashSecret, randomSecret, openToken } from '@/lib/portal-crypto';
import { authorizationUrl, instagramProfile } from '@/lib/instagram-login';

export async function connectInstagram() {
  const session = await requirePortal();
  const state = randomSecret();
  let url: string;
  try { url = authorizationUrl(state); } catch { redirect('/portal/instagram?status=configuration'); }
  await portalDb.portalSession.update({ where: { tokenHash: session.tokenHash }, data: { oauthStateHash: hashSecret(state), oauthExpiresAt: new Date(Date.now() + 10 * 60000) } });
  redirect(url);
}

export async function refreshProfile() {
  const session = await requirePortal();
  const connection = await portalDb.instagramConnection.findUnique({ where: { memberId: session.memberId } });
  if (!connection || connection.expiresAt <= new Date()) redirect('/portal/instagram?status=reconnect');
  try {
    const profile = await instagramProfile(openToken(connection.encryptedToken, session.memberId));
    if (profile.user_id !== connection.instagramId) throw new Error('Account mismatch');
    await portalDb.instagramConnection.updateMany({ where: { memberId: session.memberId, id: connection.id, encryptedToken: connection.encryptedToken }, data: { username: profile.username } });
  } catch { redirect('/portal/instagram?status=reconnect'); }
  redirect('/portal/instagram?status=refreshed');
}

export async function disconnectInstagram(_state: { error: string }, form: FormData) {
  const session = await requirePortal();
  if (form.get('confirm') !== 'yes') return { error: 'Confirmá que querés eliminar la conexión guardada.' };
  const connectionId = String(form.get('connectionId') || '');
  const version = new Date(String(form.get('version') || ''));
  if (!connectionId || connectionId.length > 128 || !Number.isFinite(version.getTime())) return { error: 'Actualizá la página antes de desconectar.' };
  // Local disconnection only; does not revoke Meta permissions shared with the live bot.
  try {
    const result = await portalDb.$transaction(async tx => {
      // Same lock order as OAuth completion: member, sessions, connection.
      const active = await tx.portalMember.updateMany({ where: { id: session.memberId, disabled: false }, data: { disabled: false } });
      if (!active.count) throw new Error('Inactive member');
      const current = await tx.instagramConnection.findUnique({ where: { memberId: session.memberId }, select: { id: true, updatedAt: true } });
      if (!current) return 'absent';
      if (current.id !== connectionId || current.updatedAt.getTime() !== version.getTime()) return 'changed';
      await tx.portalSession.updateMany({ where: { memberId: session.memberId }, data: { oauthStateHash: null, oauthExpiresAt: null } });
      const removed = await tx.instagramConnection.deleteMany({ where: { memberId: session.memberId, id: connectionId, updatedAt: version } });
      if (!removed.count) throw new Error('Connection changed');
      return 'removed';
    });
    if (result === 'changed') return { error: 'La conexión cambió desde que abriste esta página. Recargá y confirmá la cuenta nuevamente.' };
  } catch { return { error: 'No pudimos completar la desconexión. No se confirmó ningún cambio; intentá nuevamente.' }; }
  revalidatePath('/admin/instagram');
  revalidatePath('/portal/instagram');
  redirect('/portal/instagram?status=disconnected');
}

export async function logoutPortal() {
  await endPortalSession();
  redirect('/portal/login');
}
