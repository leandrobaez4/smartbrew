import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), start: vi.fn() }));
vi.mock('@/lib/portal', () => ({ portalDb: { portalMember: { findUnique: m.find } }, startPortalSession: m.start }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock('@/lib/portal-crypto', async () => await import('../../../lib/portal-crypto'));
import { hashSecret } from '@/lib/portal-crypto';
import { enterMetaReview } from './actions';
const token = 'a'.repeat(64);
const form = (value = token) => { const data = new FormData(); data.set('token', value); data.set('memberId', 'admin'); return data; };
beforeEach(() => vi.resetAllMocks());
it('rejects malformed tokens without querying the database', async () => {
  expect((await enterMetaReview({ error: '' }, form('bad'))).error).toContain('no es válido');
  expect(m.find).not.toHaveBeenCalled(); expect(m.start).not.toHaveBeenCalled();
});
it.each([null, { id: 'review', disabled: true, reviewExpiresAt: new Date(Date.now() + 60000) }, { id: 'review', disabled: false, reviewExpiresAt: null }, { id: 'review', disabled: false, reviewExpiresAt: new Date(0) }])('rejects missing, disabled, ordinary or expired access', async member => {
  m.find.mockResolvedValue(member);
  expect((await enterMetaReview({ error: '' }, form())).error).toContain('no es válido');
  expect(m.start).not.toHaveBeenCalled();
});
it('is reusable, hashes the bearer token and resolves the member server-side', async () => {
  const expires = new Date(Date.now() + 60000);
  m.find.mockResolvedValue({ id: 'review', disabled: false, reviewExpiresAt: expires });
  for (let i = 0; i < 2; i++) await expect(enterMetaReview({ error: '' }, form())).rejects.toThrow('redirect:/portal/instagram');
  expect(m.find).toHaveBeenCalledWith({ where: { reviewTokenHash: hashSecret(token) }, select: { id: true, disabled: true, reviewExpiresAt: true } });
  expect(m.start).toHaveBeenCalledTimes(2);
  expect(m.start).toHaveBeenCalledWith('review', expires);
});
it('does not expose database errors or secrets', async () => {
  m.find.mockRejectedValue(new Error(token));
  const result = await enterMetaReview({ error: '' }, form());
  expect(result.error).not.toContain(token); expect(m.start).not.toHaveBeenCalled();
});
