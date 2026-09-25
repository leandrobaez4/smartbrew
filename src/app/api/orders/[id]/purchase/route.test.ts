import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), enqueue: vi.fn() }));
vi.mock('@/lib/admin-api', () => ({ hasAdminApiSession: mocks.authorized }));
vi.mock('@/lib/dropshipping-jobs', () => ({ DropshippingJobName: { SupplierOrderJob: 'SupplierOrderJob' }, enqueueDropshippingJob: mocks.enqueue }));

import { POST } from './route';

const context = (id = 'order-1') => ({ params: Promise.resolve({ id }) });
const request = () => new Request('http://localhost/api/orders/order-1/purchase', { method: 'POST' });

describe('POST /api/orders/[id]/purchase', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires an authenticated administrator', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await POST(request(), context())).status).toBe(401);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('validates the order id before purchasing', async () => {
    mocks.authorized.mockResolvedValue(true);
    expect((await POST(request(), context('../bad'))).status).toBe(400);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues the manual supplier purchase outside the HTTP request', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.enqueue.mockResolvedValue({ status: 'queued', jobId: 'job-1' });
    const response = await POST(request(), context());
    expect(response.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith('SupplierOrderJob', { orderId: 'order-1' });
    await expect(response.json()).resolves.toEqual({ status: 'queued', jobId: 'job-1' });
  });

  it('returns safe retry and provider errors', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.enqueue.mockRejectedValueOnce(new Error('provider secret'));
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('provider secret');
  });
});
