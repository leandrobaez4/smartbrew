import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), resolve: vi.fn() }));
vi.mock('@/lib/admin-api', () => ({ hasAdminApiSession: mocks.authorized }));
vi.mock('@/lib/manual-supplier-purchase', () => ({ resolveManualSupplierPurchase: mocks.resolve }));

import { POST } from './route';

const context = (id = 'order-1') => ({ params: Promise.resolve({ id }) });
const request = (body: unknown) => new Request('http://localhost/api/orders/order-1/manual-purchase', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

describe('POST /api/orders/[id]/manual-purchase', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires an authenticated administrator', async () => {
    mocks.authorized.mockResolvedValue(false);
    expect((await POST(request({ action: 'error', error: 'x' }), context())).status).toBe(401);
  });

  it('validates and records a completed manual purchase', async () => {
    mocks.authorized.mockResolvedValue(true);
    mocks.resolve.mockResolvedValue({ status: 'completed', actualProfit: 4500 });
    const response = await POST(request({ action: 'complete', reference: 'UNI-123', actualCost: 21000 }), context());
    expect(response.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith('order-1', { action: 'complete', reference: 'UNI-123', actualCost: 21000 });
  });

  it('rejects invalid payloads before calling the service', async () => {
    mocks.authorized.mockResolvedValue(true);
    expect((await POST(request({ action: 'complete', reference: '', actualCost: -1 }), context())).status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
});
