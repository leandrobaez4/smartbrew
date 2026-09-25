import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoLibrePriceClient } from './mercado-libre-price';

afterEach(() => vi.unstubAllGlobals());

describe('MercadoLibrePriceClient', () => {
  it('updates a listing price through the item endpoint', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    const client = new MercadoLibrePriceClient('secret-token', 'https://api.example.test');

    await client.updatePrice('MLA 123', 8750.5);

    expect(request).toHaveBeenCalledWith('https://api.example.test/items/MLA%20123', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ price: 8750.5 }),
    }));
  });

  it('pauses the listing through an explicit status update', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', request);
    const client = new MercadoLibrePriceClient('secret-token');

    await client.pause('MLA123');

    expect(request).toHaveBeenCalledWith(expect.stringContaining('/items/MLA123'), expect.objectContaining({
      body: JSON.stringify({ status: 'paused' }),
    }));
  });

  it.each([0, -1, Number.NaN])('rejects an invalid price without calling Mercado Libre: %s', async (price) => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    const client = new MercadoLibrePriceClient('secret-token');

    await expect(client.updatePrice('MLA123', price)).rejects.toThrow('positivo');
    expect(request).not.toHaveBeenCalled();
  });
});
