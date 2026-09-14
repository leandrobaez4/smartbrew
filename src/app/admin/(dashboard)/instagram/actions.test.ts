import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ admin: vi.fn(), config: vi.fn(), send: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requireAdmin: mocks.admin, portalDb: { portalMember: { findUnique: mocks.find, create: mocks.create, updateMany: mocks.update } } }));
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
it.each([{ disabled: true, passwordHash: null }, { disabled: false, passwordHash: 'hash' }])('does not reinvite active or revoked users', async member => {
  mocks.find.mockResolvedValue(member);
  await inviteMember({ message: '' }, form());
  expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it('cancels the email if concurrent activation wins', async () => {
  mocks.find.mockResolvedValue({ id: 'member', disabled: false, passwordHash: null, inviteHash: 'old' });
  mocks.update.mockResolvedValue({ count: 0 });
  await inviteMember({ message: '' }, form());
  expect(mocks.send).not.toHaveBeenCalled();
});
