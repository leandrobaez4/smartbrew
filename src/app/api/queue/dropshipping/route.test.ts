import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  process: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock('@upstash/qstash', () => ({ Receiver: class { verify = mocks.verify; } }));
vi.mock('@/lib/dropshipping-jobs', () => ({
  processDropshippingQStashJob: mocks.process,
  dispatchScheduledDropshippingJobs: mocks.dispatch,
}));

import { POST } from './route';

function request(body: unknown) {
  return new Request('https://www.smartbrew.tech/api/queue/dropshipping', {
    method: 'POST',
    headers: { 'upstash-signature': 'signed', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/queue/dropshipping', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('QSTASH_CURRENT_SIGNING_KEY', 'current');
    vi.stubEnv('QSTASH_NEXT_SIGNING_KEY', 'next');
    mocks.verify.mockResolvedValue(true);
  });

  it('rejects unsigned messages', async () => {
    mocks.verify.mockResolvedValue(false);
    expect((await POST(request({ jobId: 'job-1' }))).status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
  });

  it('processes a persisted one-off job', async () => {
    mocks.process.mockResolvedValue({ status: 'ok' });
    const response = await POST(request({ jobId: 'job-1' }));
    expect(response.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledWith('job-1');
  });

  it('dispatches the periodic synchronization chain', async () => {
    mocks.dispatch.mockResolvedValue({ status: 'queued', jobs: ['one', 'two', 'three'] });
    const response = await POST(request({ schedule: 'dropshipping' }));
    expect(response.status).toBe(200);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it('returns a retryable failure when processing fails', async () => {
    mocks.process.mockRejectedValue(new Error('temporary'));
    expect((await POST(request({ jobId: 'job-1' }))).status).toBe(500);
  });
});
