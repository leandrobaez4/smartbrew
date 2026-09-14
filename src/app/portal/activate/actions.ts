'use server';
import { portalDb } from '@/lib/portal';
import { hashSecret } from '@/lib/portal-crypto';
import { portalLogin } from '../login/actions';

async function invitation(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return portalDb.portalMember.findFirst({
    where: { inviteHash: hashSecret(token), disabled: false, passwordHash: null, inviteExpiresAt: { gt: new Date() } },
    select: { email: true },
  });
}

// Read-only: mail scanners and reopening the link must not consume the invitation.
export async function inspectInvitation(token: string) {
  return Boolean(await invitation(token));
}

export async function activateInvitation(_state: { error: string }, form: FormData) {
  const token = String(form.get('token') || '');
  const password = String(form.get('password') || '');
  if (password.length < 12 || password.length > 128) return { error: 'Elegí una contraseña de entre 12 y 128 caracteres.' };
  const member = await invitation(token);
  if (!member) return { error: 'La invitación no es válida, venció o ya fue utilizada. Pedí un enlace nuevo al administrador.' };
  const login = new FormData();
  login.set('email', member.email);
  login.set('password', password);
  login.set('code', token);
  // Existing activation performs an atomic, single-use update and creates the session.
  return portalLogin({ error: '' }, login);
}
