import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoLibrePublisher, MarketplacePublicationError } from './mercado-libre-publisher';

const input = {
  title: 'Producto',
  description: 'Descripción',
  categoryId: 'MLA123',
  price: 10_000,
  currencyId: 'ARS',
  quantity: 2,
  images: ['https://example.com/product.jpg'],
  attributes: [{ id: 'BRAND', value_name: 'Marca' }],
};

afterEach(() => vi.unstubAllGlobals());

describe('MercadoLibrePublisher', () => {
  it('creates the item and then its plain-text description', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'MLA123456' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new MercadoLibrePublisher('secret', 'https://api.test').publish(input)).resolves.toEqual({ marketplaceItemId: 'MLA123456' });
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.test/items', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.test/items/MLA123456/description', expect.objectContaining({
      body: JSON.stringify({ plain_text: 'Descripción' }),
    }));
  });

  it('preserves the external item id when description creation fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'MLA123456' }), { status: 201 }))
      .mockResolvedValueOnce(new Response('provider details', { status: 400 })));
    await expect(new MercadoLibrePublisher('secret', 'https://api.test').publish(input)).rejects.toEqual(
      expect.objectContaining<Partial<MarketplacePublicationError>>({ marketplaceItemId: 'MLA123456' }),
    );
  });

  it('does not expose provider responses or call the API without credentials', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(new MercadoLibrePublisher('', 'https://api.test').publish(input)).rejects.toThrow('no está configurado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
