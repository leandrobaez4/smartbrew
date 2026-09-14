import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ find: vi.fn(), login: vi.fn() }));
vi.mock('@/lib/portal', () => ({ portalDb: { portalMember: { findFirst: mocks.find } } }));
vi.mock('@/lib/portal-crypto', () => ({ hashSecret: () => 'hashed-token' }));
vi.mock('../login/actions', () => ({ portalLogin: mocks.login }));
import { activateInvitation, inspectInvitation } from './actions';
beforeEach(() => { vi.resetAllMocks(); });
const form = () => { const f = new FormData(); f.set('token', 'a'.repeat(64)); f.set('password', 'new-password-123'); return f; };
it('rejects malformed links without querying the database', async () => {
  expect(await inspectInvitation('bad')).toBe(false);
  expect(mocks.find).not.toHaveBeenCalled();
});
it('opening the link only checks the live unused invitation, without activating it', async () => {
  mocks.find.mockResolvedValue({ email: 'invited@example.com' });
  expect(await inspectInvitation('a'.repeat(64))).toBe(true);
  expect(mocks.find).toHaveBeenCalledWith({ where: { inviteHash: 'hashed-token', disabled: false, passwordHash: null, inviteExpiresAt: { gt: expect.any(Date) } }, select: { email: true } });
  expect(mocks.login).not.toHaveBeenCalled();
});
it('rejects expired, revoked, replaced or consumed invitations at submission', async () => {
  mocks.find.mockResolvedValue(null);
  expect((await activateInvitation({ error: '' }, form())).error).toContain('invitación');
  expect(mocks.login).not.toHaveBeenCalled();
});
it('validates password length explicitly', async () => {
  const f = form(); f.set('password', 'short');
  expect((await activateInvitation({ error: '' }, f)).error).toContain('12 y 128');
  expect(mocks.find).not.toHaveBeenCalled();
});
it('resolves email from the token, ignores browser email, and uses single-use activation', async () => {
  mocks.find.mockResolvedValue({ email: 'invited@example.com' });
  mocks.login.mockResolvedValue({ error: '' });
  const f = form(); f.set('email', 'different@example.com');
  await activateInvitation({ error: '' }, f);
  const submitted = mocks.login.mock.calls[0][1] as FormData;
  expect(submitted.get('email')).toBe('invited@example.com');
  expect(submitted.get('code')).toBe('a'.repeat(64));
});
