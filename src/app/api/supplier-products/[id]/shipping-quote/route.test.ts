import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authorized: vi.fn(), findProduct: vi.fn(), settings: vi.fn(), quote: vi.fn() }));
vi.mock('@/lib/admin-api', () => ({ hasAdminApiSession: mocks.authorized }));
vi.mock('@/lib/portal', () => ({ portalDb: { supplierProduct: { findUnique: mocks.findProduct } } }));
vi.mock('@/lib/dropshipping-settings', () => ({ getDropshippingSettings: mocks.settings }));
vi.mock('@/lib/supplier-shipping-quote', () => ({ quoteSupplierProductShipping: mocks.quote }));

import { POST } from './route';

const context = { params: Promise.resolve({ id: 'product-1' }) };
const body = {
  marketplaceAccountId: '84259783', heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760,
};
const request = (value: unknown = body) => new Request('http://localhost/api/supplier-products/product-1/shipping-quote', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value),
});

describe('POST shipping quote', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authorized.mockResolvedValue(true);
    mocks.findProduct.mockResolvedValue({ pricing: { finalPriceArs: 25_000 } });
    mocks.settings.mockResolvedValue({ minimumMargin: 20, minimumProfit: 0 });
    mocks.quote.mockResolvedValue({
      sellerCostArs: 0, currencyId: 'ARS', recommendedPrice: 25_000, marketplaceFeeAmount: 3_250,
      netProfit: 5_000, marginPercentage: 20, roi: 25,
    });
  });

  it('requires an administrator and complete package measurements', async () => {
    mocks.authorized.mockResolvedValueOnce(false);
    expect((await POST(request(), context)).status).toBe(401);
    mocks.authorized.mockResolvedValueOnce(true);
    expect((await POST(request({ ...body, weightGrams: 0 }), context)).status).toBe(400);
    expect(mocks.quote).not.toHaveBeenCalled();
  });

  it('returns the seller shipping cost and recalculated final price', async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.quote).toHaveBeenCalledWith(expect.objectContaining({
      accountId: '84259783', dimensions: { heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760 },
      minimumMarginPercentage: 20, minimumProfitAmount: 0,
    }));
    await expect(response.json()).resolves.toMatchObject({ shippingCostArs: 0, finalPriceArs: 25_000, marginPercentage: 20 });
  });

  it('does not quote a product without saved pricing', async () => {
    mocks.findProduct.mockResolvedValueOnce({ pricing: null });
    expect((await POST(request(), context)).status).toBe(409);
    expect(mocks.quote).not.toHaveBeenCalled();
  });
});
