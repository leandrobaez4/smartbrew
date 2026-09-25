import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ cookie: vi.fn(), find: vi.fn(), adminSession: vi.fn(), adminFind: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock('./session', () => ({ getSession: mocks.adminSession }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { portalSession = { findUnique: mocks.find }; user = { findUnique: mocks.adminFind }; } }));
import { portalSession, requireAdmin, requirePortal } from './portal';
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => vi.unstubAllEnvs());
it('does not treat an admin cookie as a portal session', async () => {
  mocks.cookie.mockImplementation((name: string) => name === 'session' ? { value: 'admin-cookie' } : undefined);
  expect(await portalSession()).toBeNull();
  expect(mocks.find).not.toHaveBeenCalled();
});
it('redirects unauthenticated portal visitors', async () => {
  await expect(requirePortal()).rejects.toThrow('redirect:/portal/login');
});
it.each([
  { expiresAt: new Date(0), member: { disabled: false } },
  { expiresAt: new Date(Date.now() + 60000), member: { disabled: true } },
  { expiresAt: new Date(Date.now() + 60000), member: { disabled: false, reviewExpiresAt: new Date(0), reviewTokenHash: 'hash' } },
  { expiresAt: new Date(Date.now() + 60000), member: { disabled: false, reviewExpiresAt: new Date(Date.now() + 60000), reviewTokenHash: null } },
])('rejects expired/revoked sessions', async session => {
  mocks.cookie.mockReturnValue({ value: 'a'.repeat(64) });
  mocks.find.mockResolvedValue(session);
  expect(await portalSession()).toBeNull();
});
it('resolves the member only from the hashed session cookie', async () => {
  mocks.cookie.mockReturnValue({ value: 'a'.repeat(64) });
  const session = { memberId: 'a', expiresAt: new Date(Date.now() + 60000), member: { disabled: false } };
  mocks.find.mockResolvedValue(session);
  expect(await requirePortal()).toBe(session);
  expect(mocks.find.mock.calls[0][0].where.tokenHash).not.toBe('a'.repeat(64));
});
it('portal-only visitors cannot administer invitations', async () => {
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(32));
  mocks.adminSession.mockResolvedValue(null);
  await expect(requireAdmin()).rejects.toThrow('redirect:/admin/login');
});
it('preserves a safe admin destination through login', async () => {
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(32));
  mocks.adminSession.mockResolvedValue(null);
  await expect(requireAdmin('/admin/suppliers/elit-import?payload=abc_123')).rejects.toThrow(
    'redirect:/admin/login?returnTo=%2Fadmin%2Fsuppliers%2Felit-import%3Fpayload%3Dabc_123',
  );
});
it('rejects a signed session for an admin removed from the database', async () => {
  vi.stubEnv('SESSION_SECRET', 'a'.repeat(32));
  mocks.adminSession.mockResolvedValue({ user: { id: 'deleted' } });
  mocks.adminFind.mockResolvedValue(null);
  await expect(requireAdmin()).rejects.toThrow('redirect:/admin/login');
});
