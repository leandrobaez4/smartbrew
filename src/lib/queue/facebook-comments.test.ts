import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), product: vi.fn(), fetch: vi.fn(), lock: vi.fn(), upsert: vi.fn(), publish: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class {
  jobExecution = { findUnique: m.find, update: m.update, upsert: m.upsert };
  product = { findUnique: m.product };
  async $transaction(fn: (tx: unknown) => unknown) { return fn({ $queryRaw: m.lock, jobExecution: this.jobExecution }); }
} }));
vi.mock('@upstash/qstash', () => ({ Client: class { publishJSON = m.publish; } }));
import { enqueueFacebookComment, processFacebookComment } from './facebook-comments';
const input = { pageId: '123', postId: '123_456', commentId: '789' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', m.fetch);
  vi.stubEnv('FACEBOOK_COMMENTS_ENABLED', 'true');
  vi.stubEnv('FACEBOOK_PAGE_ID', '123');
  vi.stubEnv('FACEBOOK_PAGE_ACCESS_TOKEN', 'secret');
  vi.stubEnv('FACEBOOK_POST_PRODUCT_MAP', '{"123_456":"product"}');
  m.find.mockResolvedValue({ jobName: 'facebook_info_reply', status: 'STARTED', inputJson: input, entityId: 'product', outputJson: null });
  m.product.mockResolvedValue({ status: 'ACTIVE', title: 'Cafetera', affiliateUrl: 'https://meli.la/example' });
  m.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ message_id: 'message' }) });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('sends the mapped affiliate link and requires a message ID', async () => {
  expect(await processFacebookComment('job')).toBe('sent');
  const [url, request] = m.fetch.mock.calls[0];
  expect(url).toContain('/123/messages');
  expect(JSON.parse(request.body).recipient).toEqual({ comment_id: '789' });
  expect(request.body).toContain('https://meli.la/example');
  expect(m.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) }));
});
it('does not repeat a claimed or completed job', async () => {
  m.find.mockResolvedValue({ jobName: 'facebook_info_reply', status: 'STARTED', outputJson: { phase: 'CLAIMED' } });
  expect(await processFacebookComment('job')).toBe('duplicate_or_review_required');
  expect(m.fetch).not.toHaveBeenCalled();
});
it('does not send for inactive products or changed mappings', async () => {
  m.product.mockResolvedValue({ status: 'PAUSED', affiliateUrl: 'https://meli.la/example' });
  expect(await processFacebookComment('job')).toBe('review_required');
  vi.stubEnv('FACEBOOK_POST_PRODUCT_MAP', '{}');
  expect(await processFacebookComment('job')).toBe('review_required');
  expect(m.fetch).not.toHaveBeenCalled();
});
it('records ambiguous sends without retrying or logging raw Meta errors', async () => {
  m.fetch.mockRejectedValue(Error('token=secret network failure'));
  expect(await processFacebookComment('job')).toBe('review_required');
  expect(JSON.stringify(m.update.mock.calls)).not.toContain('secret');
  expect(m.fetch).toHaveBeenCalledTimes(1);
});
it('does not claim success for a 200 without a message ID', async () => {
  m.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false }) });
  expect(await processFacebookComment('job')).toBe('review_required');
});
it('fails closed when disabled', async () => {
  vi.stubEnv('FACEBOOK_COMMENTS_ENABLED', 'false');
  await expect(processFacebookComment('job')).rejects.toThrow();
  expect(m.fetch).not.toHaveBeenCalled();
});
it('uses stable persistent deduplication and can re-enqueue unclaimed jobs', async () => {
  for (const name of ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY']) vi.stubEnv(name, 'test');
  vi.stubEnv('APP_URL', 'https://www.smartbrew.tech');
  m.upsert.mockResolvedValue({ status: 'STARTED', outputJson: null });
  await enqueueFacebookComment(input);
  await enqueueFacebookComment(input);
  expect(m.upsert.mock.calls[0][0].where.id).toBe(m.upsert.mock.calls[1][0].where.id);
  expect(m.publish.mock.calls[0][0].body.jobId).toBe(m.upsert.mock.calls[0][0].where.id);
});
