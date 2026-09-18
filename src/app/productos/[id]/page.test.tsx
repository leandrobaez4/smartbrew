import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
vi.stubGlobal('React', React);
const m = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { product = { findFirst: m.find }; } }));
vi.mock('next/navigation', () => ({ notFound: () => { throw Error('404'); } }));
vi.mock('@/lib/product-url', async () => await import('../../../lib/product-url'));
vi.mock('@/lib/product-gallery', async () => await import('../../../lib/product-gallery'));
import Page from './page';
beforeEach(() => { vi.resetAllMocks(); });
it('renders a public product, gallery and affiliate CTA without price', async () => {
  m.find.mockResolvedValue({ title: 'Cafetera', affiliateUrl: 'https://meli.la/a', primaryImageUrl: 'https://http2.mlstatic.com/a.jpg', imageUrls: ['https://http2.mlstatic.com/b.jpg'] });
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: 'product' }) }));
  expect(html).toContain('Comprar en Mercado Libre');
  expect(html).toContain('https://meli.la/a');
  expect(html).toContain('Ver foto 2');
  expect(html).toContain('Enlace de afiliado');
  expect(m.find.mock.calls[0][0].where).toEqual({ id: 'product', status: 'ACTIVE', affiliateUrl: { not: null } });
});
it('returns 404 for missing or unavailable products', async () => {
  m.find.mockResolvedValue(null);
  await expect(Page({ params: Promise.resolve({ id: 'missing' }) })).rejects.toThrow('404');
});
it('does not expose an unsafe purchase URL', async () => {
  m.find.mockResolvedValue({ title: 'Bad', affiliateUrl: 'javascript:alert(1)', imageUrls: [] });
  await expect(Page({ params: Promise.resolve({ id: 'bad' }) })).rejects.toThrow('404');
});
