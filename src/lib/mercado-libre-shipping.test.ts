import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoLibreShippingClient, parseMercadoLibreShippingQuote } from './mercado-libre-shipping';

afterEach(() => vi.unstubAllGlobals());

describe('MercadoLibreShippingClient', () => {
  it('parses the estimated seller cost', () => {
    expect(parseMercadoLibreShippingQuote({ coverage: { all_country: { list_cost: 2_500.5, currency_id: 'ARS' } } }))
      .toEqual({ sellerCostArs: 2_500.5, currencyId: 'ARS' });
  });

  it('quotes ME2 buyer-paid shipping with package measurements', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      coverage: { all_country: { list_cost: 0, currency_id: 'ARS' } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new MercadoLibreShippingClient('secret', 'https://api.test').quote({
      accountId: '84259783', itemPriceArs: 25_000, listingTypeId: 'gold_special',
      dimensions: { heightCm: 8, widthCm: 18, lengthCm: 22, weightGrams: 760 },
    })).resolves.toEqual({ sellerCostArs: 0, currencyId: 'ARS' });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe('/users/84259783/shipping_options/free');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      dimensions: '8x18x22,760', mode: 'me2', logistic_type: 'drop_off', free_shipping: 'false',
    });
  });
});
