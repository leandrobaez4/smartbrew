import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoLibreStockClient } from './mercado-libre-stock';

afterEach(() => vi.unstubAllGlobals());

describe('MercadoLibreStockClient', () => {
  it('updates the exact available quantity through the item endpoint', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    const client = new MercadoLibreStockClient('secret-token', 'https://api.example.test');

    await client.updateAvailableQuantity('MLA 123', 7);

    expect(request).toHaveBeenCalledWith('https://api.example.test/items/MLA%20123', expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      body: JSON.stringify({ available_quantity: 7 }),
    }));
  });

  it.each([-1, 1.5, Number.NaN])('rejects an invalid quantity without calling Mercado Libre: %s', async (quantity) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const client = new MercadoLibreStockClient('secret-token');

    await expect(client.updateAvailableQuantity('MLA123', quantity)).rejects.toThrow('entero no negativo');
    expect(request).not.toHaveBeenCalled();
  });

  it('returns a safe provider error without exposing its response body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    const client = new MercadoLibreStockClient('secret-token');

    await expect(client.updateAvailableQuantity('MLA123', 0)).rejects.toThrow('HTTP 429');
  });
});
