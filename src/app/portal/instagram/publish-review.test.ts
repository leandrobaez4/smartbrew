import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn(), member: vi.fn(), connection: vi.fn(), create: vi.fn(), update: vi.fn(), profile: vi.fn(), meta: vi.fn(), wait: vi.fn() }));
vi.mock('@/lib/portal', () => ({ requirePortal: m.auth, portalDb: { $transaction: m.transaction, instagramConnection: { findUnique: m.connection }, reviewPublication: { update: m.update } } }));
vi.mock('@/lib/portal-crypto', () => ({ openToken: () => 'review-token' }));
vi.mock('@/lib/instagram-login', () => ({ instagramLoginConfig: () => ({ origin: 'https://www.smartbrew.tech', version: 'v26.0' }), instagramProfile: m.profile }));
vi.mock('@/lib/meta-api', async () => ({ ...await import('../../../lib/meta-api'), requestMeta: m.meta }));
vi.mock('@/lib/instagram-container', () => ({ waitForInstagramContainer: m.wait }));
vi.mock('@/lib/review-publication-content', async () => await import('../../../lib/review-publication-content'));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { publishReviewPhoto } from './publish-review';
const version = new Date('2026-09-16T12:00:00Z');
const connection = () => ({ id: 'connection', instagramId: '456', username: 'reviewer', updatedAt: version, expiresAt: new Date(Date.now() + 60000), encryptedToken: 'encrypted' });
const form = () => { const f = new FormData(); f.set('confirm', 'yes'); f.set('connectionId', 'connection'); f.set('version', version.toISOString()); f.set('instagramId', 'evil-account'); f.set('image_url', 'https://evil.example'); return f; };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('INSTAGRAM_ACCOUNT_ID', '123'); vi.stubEnv('INSTAGRAM_DELETE_FACEBOOK_ACCOUNT_ID', '321');
  m.auth.mockResolvedValue({ memberId: 'review', member: { reviewExpiresAt: new Date(Date.now() + 60000), reviewTokenHash: 'hash' } });
  m.member.mockResolvedValue({ count: 1 }); m.connection.mockResolvedValue(connection());
  m.transaction.mockImplementation(fn => fn({ portalMember: { updateMany: m.member }, instagramConnection: { findUnique: m.connection }, reviewPublication: { create: m.create } }));
  m.profile.mockResolvedValue({ user_id: '456', username: 'reviewer' });
  m.meta.mockResolvedValueOnce({ id: '777' }).mockResolvedValueOnce({ id: '888' });
});
afterEach(() => vi.unstubAllEnvs());
it('uses only the reviewer account, fixed content and saved encrypted token', async () => {
  expect((await publishReviewPhoto({ message: '' }, form())).message).toContain('888');
  expect(m.meta.mock.calls[0][1]).toBe('https://graph.instagram.com/v26.0/456/media');
  expect(m.meta.mock.calls[0][2].headers.Authorization).toBe('Bearer review-token');
  expect(m.meta.mock.calls[0][2].body.get('image_url')).toBe('https://www.smartbrew.tech/logo.jpg');
  expect(m.meta.mock.calls[1][2].body.get('creation_id')).toBe('777');
  expect(m.wait).toHaveBeenCalledWith('https://graph.instagram.com/v26.0', 'review-token', '777');
  expect(m.wait.mock.invocationCallOrder[0]).toBeLessThan(m.meta.mock.invocationCallOrder[1]);
  expect(m.update).toHaveBeenLastCalledWith({ where: { memberId: 'review' }, data: { status: 'PUBLISHED', mediaId: '888', message: 'Publicación confirmada por Instagram.' } });
});
it('rejects unauthenticated callers', async () => {
  m.auth.mockRejectedValue(Error('login'));
  await expect(publishReviewPhoto({ message: '' }, form())).rejects.toThrow('login');
  expect(m.meta).not.toHaveBeenCalled();
});
it.each([{}, { reviewExpiresAt: new Date(0), reviewTokenHash: 'hash' }, { reviewExpiresAt: new Date(Date.now() + 60000) }])('rejects ordinary, expired or revoked review access', async member => {
  m.auth.mockResolvedValue({ memberId: 'review', member });
  await publishReviewPhoto({ message: '' }, form()); expect(m.transaction).not.toHaveBeenCalled();
});
it('requires consent and the current connection version', async () => {
  const f = form(); f.delete('confirm'); await publishReviewPhoto({ message: '' }, f); expect(m.create).not.toHaveBeenCalled();
  const stale = form(); stale.set('version', 'old'); await publishReviewPhoto({ message: '' }, stale); expect(m.create).not.toHaveBeenCalled();
});
it.each(['123', '321'])('blocks production account %s before creating a container', async id => {
  m.connection.mockResolvedValue({ ...connection(), instagramId: id });
  await publishReviewPhoto({ message: '' }, form()); expect(m.meta).not.toHaveBeenCalled();
});
it('blocks production username and token/account mismatch', async () => {
  m.profile.mockResolvedValue({ user_id: '456', username: 'smartbrewmrl' });
  await publishReviewPhoto({ message: '' }, form()); expect(m.meta).not.toHaveBeenCalled();
  m.profile.mockResolvedValue({ user_id: '999', username: 'reviewer' });
  await publishReviewPhoto({ message: '' }, form()); expect(m.meta).not.toHaveBeenCalled();
});
it('keeps a unique durable claim across concurrent submissions', async () => {
  let claimed = false;
  m.create.mockImplementation(async () => { if (claimed) throw Error('unique constraint'); claimed = true; });
  await Promise.all([publishReviewPhoto({ message: '' }, form()), publishReviewPhoto({ message: '' }, form())]);
  expect(m.meta).toHaveBeenCalledTimes(2); // One container and one publish, not two posts.
});
it('does not publish before readiness or expose provider secrets', async () => {
  m.wait.mockRejectedValue(Error('review-token'));
  const result = await publishReviewPhoto({ message: '' }, form());
  expect(m.meta).toHaveBeenCalledTimes(1); expect(result.message).not.toContain('review-token');
});
it('cancels publishing after disconnection while waiting', async () => {
  m.connection.mockResolvedValueOnce(connection()).mockResolvedValueOnce(null);
  await publishReviewPhoto({ message: '' }, form()); expect(m.meta).toHaveBeenCalledTimes(1);
});
it('preserves ambiguity when media_publish fails', async () => {
  m.meta.mockReset().mockResolvedValueOnce({ id: '777' }).mockRejectedValueOnce(Error('timeout'));
  await publishReviewPhoto({ message: '' }, form());
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNCERTAIN' }) }));
});
it('keeps the returned media ID when persistence after publishing fails', async () => {
  m.update.mockResolvedValueOnce({}).mockRejectedValueOnce(Error('db')).mockResolvedValueOnce({});
  await publishReviewPhoto({ message: '' }, form());
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'UNCERTAIN', mediaId: '888' }) }));
});
