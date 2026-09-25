import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from './session';
import { hashSecret, randomSecret } from './portal-crypto';
import { normalizeAdminReturnTo } from './admin-return-to';

export const portalDb = new PrismaClient();
const cookieName = 'smartbrew_portal';

export async function requireAdmin(returnTo?: string) {
  // Never accept the legacy session fallback key for invitation administration.
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Configure SESSION_SECRET');
  const session = await getSession();
  const id = session?.user?.id;
  if (typeof id !== 'string' || !await portalDb.user.findUnique({ where: { id } })) {
    const destination = normalizeAdminReturnTo(returnTo);
    redirect(destination ? `/admin/login?returnTo=${encodeURIComponent(destination)}` : '/admin/login');
  }
}

export async function portalSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await portalDb.portalSession.findUnique({ where: { tokenHash: hashSecret(token) }, include: { member: true } });
  if (!session || session.expiresAt <= new Date() || session.member.disabled) return null;
  if (session.member.reviewExpiresAt && (!session.member.reviewTokenHash || session.member.reviewExpiresAt <= new Date())) return null;
  return session;
}

export async function requirePortal() {
  const session = await portalSession();
  if (!session) redirect('/portal/login');
  return session;
}

export async function startPortalSession(memberId: string, accessDeadline?: Date) {
  const jar = await cookies();
  const old = jar.get(cookieName)?.value;
  if (old) await portalDb.portalSession.deleteMany({ where: { tokenHash: hashSecret(old) } });
  const token = randomSecret();
  const expiresAt = new Date(Math.min(Date.now() + 86400000, accessDeadline?.getTime() ?? Infinity));
  if (expiresAt <= new Date()) throw new Error('Access expired');
  await portalDb.portalSession.create({ data: { tokenHash: hashSecret(token), memberId, expiresAt } });
  jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) });
}

export async function endPortalSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await portalDb.portalSession.deleteMany({ where: { tokenHash: hashSecret(token) } });
  jar.delete(cookieName);
}
