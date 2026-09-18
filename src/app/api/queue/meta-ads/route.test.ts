import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ verify: vi.fn(), process: vi.fn() }));
vi.mock('@upstash/qstash', () => ({ Receiver: class { verify = m.verify; } }));
vi.mock('@/lib/queue/meta-ads', () => ({ processPausedAd: m.process }));
import { POST } from './route';
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current'); vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'next'); });
afterEach(() => vi.unstubAllEnvs());
const request = (body = '{"jobId":"job123"}') => new Request('https://www.smartbrew.tech/api/queue/meta-ads', { method: 'POST', body });
it('fails closed without signing configuration', async () => {
  vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', '');
  expect((await POST(request())).status).toBe(503);
  expect(m.process).not.toHaveBeenCalled();
});
it('rejects unsigned or invalid deliveries before processing', async () => {
  m.verify.mockRejectedValue(Error('invalid'));
  expect((await POST(request())).status).toBe(401);
  expect(m.process).not.toHaveBeenCalled();
});
it('processes only verified well-formed job identifiers', async () => {
  m.verify.mockResolvedValue(true);
  expect((await POST(request('{"jobId":"../../invalid"}'))).status).toBe(400);
  expect(m.process).not.toHaveBeenCalled();
  expect((await POST(request())).status).toBe(200);
  expect(m.process).toHaveBeenCalledWith('job123');
});
it('allows delivery retry on infrastructure errors', async () => {
  m.verify.mockResolvedValue(true); m.process.mockRejectedValue(Error('database unavailable'));
  expect((await POST(request())).status).toBe(500);
});
