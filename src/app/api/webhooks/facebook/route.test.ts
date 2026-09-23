import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock('../../../../lib/queue/facebook-comments', () => ({ enqueueFacebookComment: m.enqueue }));
import { GET, POST } from './route';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('FACEBOOK_APP_SECRET', 'secret');
  vi.stubEnv('FACEBOOK_PAGE_ID', '123');
  vi.stubEnv('FACEBOOK_COMMENTS_ENABLED', 'true');
  vi.stubEnv('FACEBOOK_WEBHOOK_VERIFY_TOKEN', 'verify');
});
afterEach(() => vi.unstubAllEnvs());
function request(signed = true) {
  const body = JSON.stringify({ object: 'page', entry: [{ id: '123', changes: [{ field: 'feed', value: { item: 'comment', verb: 'add', message: 'Info', post_id: '123_456', comment_id: '789' } }] }] });
  return new Request('https://example.com/api/webhooks/facebook', { method: 'POST', body, headers: signed ? { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret').update(body).digest('hex')}` } : {} });
}
it('validates handshake without a default verify token', async () => {
  expect(await (await GET(new Request('https://example.com?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=challenge'))).text()).toBe('challenge');
  vi.stubEnv('FACEBOOK_WEBHOOK_VERIFY_TOKEN', '');
  expect((await GET(new Request('https://example.com?hub.mode=subscribe&hub.verify_token=&hub.challenge=challenge'))).status).toBe(403);
});
it('rejects unsigned events before queue access', async () => {
  expect((await POST(request(false))).status).toBe(403);
  expect(m.enqueue).not.toHaveBeenCalled();
});
it('queues signed Info events', async () => {
  expect((await POST(request())).status).toBe(200);
  expect(m.enqueue).toHaveBeenCalledWith({ pageId: '123', postId: '123_456', commentId: '789' });
});
it('returns a retryable status when enqueue fails', async () => {
  m.enqueue.mockRejectedValue(Error('queue'));
  expect((await POST(request())).status).toBe(503);
});
it('does not enqueue while disabled', async () => {
  vi.stubEnv('FACEBOOK_COMMENTS_ENABLED', 'false');
  expect((await POST(request())).status).toBe(200);
  expect(m.enqueue).not.toHaveBeenCalled();
});
