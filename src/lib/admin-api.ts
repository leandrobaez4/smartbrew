import { getSession } from './session';
import { portalDb } from './portal';

export async function hasAdminApiSession() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return false;
  const session = await getSession();
  const id = session?.user?.id;
  if (typeof id !== 'string') return false;
  return Boolean(await portalDb.user.findUnique({ where: { id }, select: { id: true } }));
}
