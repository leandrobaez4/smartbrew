import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), config: vi.fn(), send: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), transaction: vi.fn(), sessions: vi.fn(), connections: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requireAdmin: mocks.admin, portalDb: { portalMember: { findUnique: mocks.find, create: mocks.create, updateMany: mocks.update }, $transaction: mocks.transaction } }));
vi.mock('@/lib/portal-email', () => ({ portalEmailConfig: mocks.config, sendPortalInvitation: mocks.send }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/portal-crypto', () => ({ randomSecret: () => 'a'.repeat(64), hashSecret: () => 'hashed-code' }));
import { inviteMember } from './actions';
const form = () => { const data = new FormData(); data.set('email', 'member@example.com'); return data; };
beforeEach(() => { vi.resetAllMocks(); mocks.find.mockResolvedValue(null); mocks.create.mockResolvedValue({}); mocks.send.mockResolvedValue('email-id'); });
it('requires admin authorization before creating or sending', async () => {
  mocks.admin.mockRejectedValue(new Error('Unauthorized'));
  await expect(inviteMember({ message: '' }, form())).rejects.toThrow('Unauthorized');
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it('does not persist invitations without mail configuration', async () => {
  mocks.config.mockImplementation(() => { throw Error(); });
  expect((await inviteMember({ message: '' }, form())).message).toContain('Falta configurar');
  expect(mocks.create).not.toHaveBeenCalled();
});
it('sends only after persisting the invitation and does not return its code on success', async () => {
  const result = await inviteMember({ message: '' }, form());
  expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  expect(result.code).toBeUndefined(); expect(result.message).toContain('aceptó');
});
it('provides a private fallback without falsely claiming delivery', async () => {
  mocks.send.mockRejectedValue(new Error('timeout'));
  const result = await inviteMember({ message: '' }, form());
  expect(result.code).toMatch(/^[a-f0-9]{64}$/); expect(result.message).toContain('no pudimos confirmar');
});
it.each([{ disabled: false, passwordHash: 'hash' }])('does not reinvite active users', async member => {
  mocks.find.mockResolvedValue(member);
  await inviteMember({ message: '' }, form());
  expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it('reinvites revoked users with fresh credentials and no old sessions or connection', async () => {
  mocks.find.mockResolvedValue({ id: 'member', disabled: true, passwordHash: 'old-password' });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async callback => callback({ portalMember: { updateMany: mocks.update }, portalSession: { deleteMany: mocks.sessions }, instagramConnection: { deleteMany: mocks.connections } }));
  const result = await inviteMember({ message: '' }, form());
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'member', disabled: true }, data: expect.objectContaining({ disabled: false, passwordHash: null, loginAttempts: 0, loginWindowEnd: null, inviteHash: 'hashed-code' }) });
  expect(mocks.sessions).toHaveBeenCalledWith({ where: { memberId: 'member' } });
  expect(mocks.connections).toHaveBeenCalledWith({ where: { memberId: 'member' } });
  expect(mocks.connections.mock.invocationCallOrder[0]).toBeLessThan(mocks.send.mock.invocationCallOrder[0]);
  expect(result.message).toContain('aceptó');
});
it('does not send when the reinvitation transaction fails', async () => {
  mocks.find.mockResolvedValue({ id: 'member', disabled: true, passwordHash: 'old-password' });
  mocks.transaction.mockRejectedValue(new Error('Transaction failed'));
  await inviteMember({ message: '' }, form());
  expect(mocks.send).not.toHaveBeenCalled();
});
it('cancels the email if concurrent activation wins', async () => {
  mocks.find.mockResolvedValue({ id: 'member', disabled: false, passwordHash: null, inviteHash: 'old' });
  mocks.update.mockResolvedValue({ count: 0 });
  await inviteMember({ message: '' }, form());
  expect(mocks.send).not.toHaveBeenCalled();
});
