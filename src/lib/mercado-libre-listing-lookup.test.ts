import { describe, expect, it, vi } from 'vitest';
import { MercadoLibreListingLookupClient } from './mercado-libre-listing-lookup';

describe('Mercado Libre listing lookup', () => {
  it('searches by SELLER_SKU and validates every result against the OAuth account', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: ['MLA123456'] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'MLA123456', seller_id: 84259783, price: 24_999, status: 'active', title: 'Mini aspiradora', permalink: 'https://articulo.mercadolibre.com.ar/MLA-123456',
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const client = new MercadoLibreListingLookupClient('token', 'https://api.example.test');

    await expect(client.searchBySellerSku('84259783', 'MINASPGATITO')).resolves.toEqual([
      expect.objectContaining({ id: 'MLA123456', seller_id: '84259783', price: 24_999 }),
    ]);
    expect(fetcher.mock.calls[0][0]).toContain('/users/84259783/items/search?seller_sku=MINASPGATITO');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer token');
  });

  it('rejects an item from another account and reports only a safe status error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'MLA123456', seller_id: 1, price: 1, status: 'active', title: 'Otro', permalink: 'https://articulo.mercadolibre.com.ar/MLA-123456',
    }), { status: 200 })));
    const client = new MercadoLibreListingLookupClient('secret-token', 'https://api.example.test');
    await expect(client.getItem('84259783', 'MLA123456')).rejects.toThrow('no pertenece');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream body', { status: 500 })));
    await expect(client.getItem('84259783', 'MLA123456')).rejects.toThrow('HTTP 500');
    await expect(client.getItem('84259783', 'MLA123456')).rejects.not.toThrow('private upstream body');
  });
});
