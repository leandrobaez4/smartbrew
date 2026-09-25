import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), enqueue: vi.fn() }));
vi.mock('@/lib/admin-api', () => ({ hasAdminApiSession: mocks.authorized }));
vi.mock('@/lib/dropshipping-jobs', () => ({ DropshippingJobName: { MarketplacePublishJob: 'MarketplacePublishJob' }, enqueueDropshippingJob: mocks.enqueue }));

import { POST } from './route';

const context = (id = 'product-1') => ({ params: Promise.resolve({ id }) });
const validBody = {
  marketplaceAccountId: 'account-1',
  marketplaceFee: 1_000,
  shippingCost: 500,
  taxes: 500,
  extraCosts: 0,
  targetMarginPercentage: 20,
};
const request = (body: unknown = validBody) => new Request('http://localhost/api/supplier-products/product-1/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('POST /api/supplier-products/[id]/publish', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires an administrator before parsing or publishing', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await POST(request(), context())).status).toBe(401);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('rejects malformed ids, costs and margins', async () => {
    mocks.authorized.mockResolvedValue(true);
    expect((await POST(request(), context('../bad'))).status).toBe(400);
    expect((await POST(request({ ...validBody, marketplaceFee: -1 }), context())).status).toBe(400);
    expect((await POST(request({ ...validBody, targetMarginPercentage: 100 }), context())).status).toBe(400);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('enqueues publication outside the HTTP request', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.enqueue.mockResolvedValue({ status: 'queued', jobId: 'job-1' });
    const response = await POST(request(), context());
    expect(response.status).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith('MarketplacePublishJob', { supplierProductId: 'product-1', ...validBody });
    await expect(response.json()).resolves.toEqual({ status: 'queued', jobId: 'job-1' });
  });

  it('returns safe errors for validation and provider failures', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.enqueue.mockRejectedValueOnce(new Error('secret provider response'));
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('secret provider response');
  });
});
