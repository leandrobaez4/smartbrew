import { afterEach, expect, it, vi } from 'vitest';
import { isMarketplaceImageUrl, MercadoLibreClient } from './ml-client';

afterEach(() => vi.unstubAllGlobals());

it('keeps real marketplace fields and normalizes attributes and gallery images', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'MLA123',
      title: 'Cafetera Modelo X',
      category_id: 'MLA-CAFE',
      price: 120000,
      currency_id: 'ARS',
      permalink: 'https://articulo.mercadolibre.com.ar/MLA-123',
      thumbnail: 'https://http2.mlstatic.com/a-I.jpg',
      pictures: [{ secure_url: 'https://http2.mlstatic.com/a-O.jpg' }],
      attributes: [{ id: 'BRAND', value_name: 'Marca real' }, { id: 'MODEL', value_name: 'X' }],
      seller: { id: 42, nickname: 'TIENDA' },
      available_quantity: 3,
      shipping: { free_shipping: true },
      sold_quantity: 8,
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ plain_text: 'Descripción original.' }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);

  const product = await new MercadoLibreClient().getProduct('MLA123');

  expect(product).toMatchObject({
    externalId: 'MLA123',
    title: 'Cafetera Modelo X',
    originalDescription: 'Descripción original.',
    imageUrls: ['https://http2.mlstatic.com/a-O.jpg'],
    attributesJson: { BRAND: 'Marca real', MODEL: 'X' },
    sellerId: '42',
    seller: 'TIENDA',
  });
});

it('does not fail the product import when the optional description is unavailable', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'MLA123', title: 'Producto', category_id: null, price: null, currency_id: null,
      permalink: 'https://articulo.mercadolibre.com.ar/MLA-123', attributes: [], pictures: [],
      seller: {}, available_quantity: 0, shipping: {}, sold_quantity: 0,
    }), { status: 200 }))
    .mockRejectedValueOnce(new Error('description timeout'));
  vi.stubGlobal('fetch', fetchMock);

  await expect(new MercadoLibreClient().getProduct('MLA123')).resolves.toMatchObject({
    originalDescription: null,
    imageUrls: [],
  });
});

it.each([
  ['https://http2.mlstatic.com/product.jpg', true],
  ['https://http2.mlstatic.com/product.JPEG?size=large', true],
  ['https://http2.mlstatic.com/product.webp', true],
  ['https://http2.mlstatic.com/product.mp4', false],
  ['https://http2.mlstatic.com/product.mov?format=jpg', false],
  ['http://http2.mlstatic.com/product.jpg', false],
  ['javascript:alert(1)', false],
])('classifies marketplace media URL %s', (url, expected) => {
  expect(isMarketplaceImageUrl(url)).toBe(expected);
});

it('excludes video media from Mercado Libre and falls back to the first valid image', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'MLA456',
      title: 'Producto con video',
      category_id: 'MLA-TECH',
      price: 50000,
      currency_id: 'ARS',
      permalink: 'https://articulo.mercadolibre.com.ar/MLA-456',
      thumbnail: 'https://http2.mlstatic.com/demo.webm',
      pictures: [
        { secure_url: 'https://http2.mlstatic.com/demo.mp4' },
        { secure_url: 'https://http2.mlstatic.com/photo-O.jpg' },
        { secure_url: 'https://http2.mlstatic.com/photo-O.jpg' },
        { secure_url: 'https://http2.mlstatic.com/clip.mov', url: 'https://http2.mlstatic.com/fallback.png' },
      ],
      attributes: [],
      seller: {},
      available_quantity: 1,
      shipping: {},
      sold_quantity: 0,
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 404 }));
  vi.stubGlobal('fetch', fetchMock);

  const product = await new MercadoLibreClient().getProduct('MLA456');

  expect(product.primaryImageUrl).toBe('https://http2.mlstatic.com/photo-O.jpg');
  expect(product.imageUrls).toEqual([
    'https://http2.mlstatic.com/photo-O.jpg',
    'https://http2.mlstatic.com/fallback.png',
  ]);
});
