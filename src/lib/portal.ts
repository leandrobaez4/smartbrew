import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession } from './session';
import { hashSecret, randomSecret } from './portal-crypto';

export const portalDb = new PrismaClient();
const cookieName = 'smartbrew_portal';

export async function requireAdmin() {
  // Never accept the legacy session fallback key for invitation administration.
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Configure SESSION_SECRET');
  const session = await getSession();
  const id = session?.user?.id;
  if (typeof id !== 'string' || !await portalDb.user.findUnique({ where: { id } })) redirect('/admin/login');
}

export async function portalSession() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await portalDb.portalSession.findUnique({ where: { tokenHash: hashSecret(token) }, include: { member: true } });
  if (!session || session.expiresAt <= new Date() || session.member.disabled) return null;
  return session;
}

export async function requirePortal() {
  const session = await portalSession();
  if (!session) redirect('/portal/login');
  return session;
}

export async function startPortalSession(memberId: string) {
  const jar = await cookies();
  const old = jar.get(cookieName)?.value;
  if (old) await portalDb.portalSession.deleteMany({ where: { tokenHash: hashSecret(old) } });
  const token = randomSecret();
  await portalDb.portalSession.create({ data: { tokenHash: hashSecret(token), memberId, expiresAt: new Date(Date.now() + 86400000) } });
  jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 });
}

export async function endPortalSession() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await portalDb.portalSession.deleteMany({ where: { tokenHash: hashSecret(token) } });
  jar.delete(cookieName);
}
