import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), member: vi.fn(), find: vi.fn(), sessions: vi.fn(), remove: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requirePortal: m.auth, portalDb: { $transaction: m.transaction }, endPortalSession: vi.fn() }));
vi.mock('@/lib/portal-crypto', () => ({ hashSecret: vi.fn(), randomSecret: vi.fn(), openToken: vi.fn() }));
vi.mock('@/lib/instagram-login', () => ({ authorizationUrl: vi.fn(), instagramProfile: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: m.revalidate }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw Error(`redirect:${url}`); } }));
import { disconnectInstagram } from './actions';
const version = '2026-09-15T12:00:00.000Z';
function form() { const f = new FormData(); f.set('confirm', 'yes'); f.set('connectionId', 'connection'); f.set('version', version); return f; }
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ memberId: 'owner' });
  m.member.mockResolvedValue({ count: 1 });
  m.find.mockResolvedValue({ id: 'connection', updatedAt: new Date(version) });
  m.remove.mockResolvedValue({ count: 1 });
  m.transaction.mockImplementation(callback => callback({ portalMember: { updateMany: m.member }, portalSession: { updateMany: m.sessions }, instagramConnection: { findUnique: m.find, deleteMany: m.remove } }));
});
it('requires authentication', async () => {
  m.auth.mockRejectedValue(Error('Login required'));
  await expect(disconnectInstagram({ error: '' }, form())).rejects.toThrow('Login required');
  expect(m.transaction).not.toHaveBeenCalled();
});
it('requires explicit confirmation', async () => {
  const f = form(); f.delete('confirm');
  expect((await disconnectInstagram({ error: '' }, f)).error).toContain('Confirmá');
  expect(m.transaction).not.toHaveBeenCalled();
});
it('does not disconnect a different or replaced account from a stale form', async () => {
  m.find.mockResolvedValue({ id: 'new-connection', updatedAt: new Date(version) });
  expect((await disconnectInstagram({ error: '' }, form())).error).toContain('cambió');
  expect(m.remove).not.toHaveBeenCalled(); expect(m.sessions).not.toHaveBeenCalled();
});
it('scopes all changes to the signed-in member and cancels OAuth before deletion', async () => {
  const f = form(); f.set('memberId', 'someone-else');
  await expect(disconnectInstagram({ error: '' }, f)).rejects.toThrow('redirect:/portal/instagram?status=disconnected');
  expect(m.remove).toHaveBeenCalledWith({ where: { memberId: 'owner', id: 'connection', updatedAt: new Date(version) } });
  expect(m.sessions).toHaveBeenCalledWith({ where: { memberId: 'owner' }, data: { oauthStateHash: null, oauthExpiresAt: null } });
  expect(m.sessions.mock.invocationCallOrder[0]).toBeLessThan(m.remove.mock.invocationCallOrder[0]);
  expect(m.revalidate).toHaveBeenCalledWith('/admin/instagram');
});
it('reports database errors without leaking details or claiming success', async () => {
  m.transaction.mockRejectedValue(Error('private database detail'));
  const result = await disconnectInstagram({ error: '' }, form());
  expect(result.error).toContain('No pudimos');
  expect(result.error).not.toContain('private');
  expect(m.revalidate).not.toHaveBeenCalled();
});
it('handles an already disconnected account without deleting anything else', async () => {
  m.find.mockResolvedValue(null);
  await expect(disconnectInstagram({ error: '' }, form())).rejects.toThrow('redirect:');
  expect(m.remove).not.toHaveBeenCalled();
});
