import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ admin: vi.fn(), create: vi.fn(), update: vi.fn(), sessions: vi.fn(), connections: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requireAdmin: m.admin, portalDb: { portalMember: { create: m.create, update: m.update }, portalSession: { deleteMany: m.sessions }, instagramConnection: { deleteMany: m.connections }, $transaction: m.transaction } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/portal-crypto', async () => await import('../../../../lib/portal-crypto'));
vi.mock('@/lib/portal-email', () => ({ portalEmailConfig: vi.fn(), sendPortalInvitation: vi.fn() }));
import { createMetaReviewAccess, revokeMember } from './actions';
import { hashSecret } from '@/lib/portal-crypto';
const form = () => { const f = new FormData(); f.set('confirmed', 'on'); return f; };
beforeEach(() => vi.resetAllMocks());
it('requires an authenticated administrator', async () => {
  m.admin.mockRejectedValue(new Error('unauthorized'));
  await expect(createMetaReviewAccess({ message: '' }, form())).rejects.toThrow('unauthorized');
  expect(m.create).not.toHaveBeenCalled();
});
it('requires explicit review confirmation', async () => {
  await createMetaReviewAccess({ message: '' }, new FormData());
  expect(m.create).not.toHaveBeenCalled();
});
it('creates isolated 60-day portal access with only a hash stored', async () => {
  const now = Date.now();
  const result = await createMetaReviewAccess({ message: '' }, form());
  expect(result.token).toMatch(/^[a-f0-9]{64}$/);
  const data = m.create.mock.calls[0][0].data;
  expect(data.reviewTokenHash).toBe(hashSecret(result.token!));
  expect(data.reviewExpiresAt.getTime()).toBeGreaterThanOrEqual(now + 60 * 86400000);
  expect(data.reviewExpiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 86400000);
  expect(data.email).toMatch(/^meta-review-[a-f0-9]{64}@review.invalid$/);
  expect(data.passwordHash).toBeUndefined(); expect(data.inviteHash).toBeUndefined();
  expect(JSON.stringify(data)).not.toContain(result.token);
});
it('does not expose a token if persistence fails', async () => {
  m.create.mockRejectedValue(Error('database'));
  expect((await createMetaReviewAccess({ message: '' }, form())).token).toBeUndefined();
});
it('revokes the reusable token, sessions and stored connection together', async () => {
  const f = new FormData(); f.set('memberId', 'review');
  await revokeMember(f);
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'review' }, data: { disabled: true, inviteHash: null, reviewTokenHash: null } });
  expect(m.sessions).toHaveBeenCalledWith({ where: { memberId: 'review' } });
  expect(m.connections).toHaveBeenCalledWith({ where: { memberId: 'review' } });
  expect(m.transaction).toHaveBeenCalled();
});
