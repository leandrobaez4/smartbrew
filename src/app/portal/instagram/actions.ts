'use server';
import { redirect } from 'next/navigation';
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

export async function disconnectInstagram() {
  const session = await requirePortal();
  // Local disconnection only; does not revoke Meta permissions shared with the live bot.
  await portalDb.$transaction([
    portalDb.portalSession.updateMany({ where: { memberId: session.memberId }, data: { oauthStateHash: null, oauthExpiresAt: null } }),
    portalDb.instagramConnection.deleteMany({ where: { memberId: session.memberId } }),
  ]);
  redirect('/portal/instagram?status=disconnected');
}

export async function logoutPortal() {
  await endPortalSession();
  redirect('/portal/login');
}
