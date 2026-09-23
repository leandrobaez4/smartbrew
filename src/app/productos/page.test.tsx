import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { product = { findMany: mocks.findMany }; } }));
vi.mock('@/lib/product-categories', async () => await import('../../lib/product-categories'));
vi.mock('@/lib/product-search', async () => await import('../../lib/product-search'));
vi.mock('@/lib/product-url', async () => await import('../../lib/product-url'));
vi.mock('@/app/productos/ProductGrid', async () => await import('./ProductGrid'));

import Page from './page';
import { filterPublicProducts } from '../../lib/product-search';

const products = [
  { id: '1', title: 'Título base', originalTitle: 'Cafetera Italiana', displayTitle: 'Café en casa', shortDescription: 'Compacta', category: 'cafe', tags: ['barista', 'acero'], primaryImageUrl: null, affiliateUrl: 'https://meli.la/1' },
  { id: '2', title: 'Auriculares', originalTitle: null, displayTitle: null, shortDescription: null, category: 'tecnologia', tags: ['audio'], primaryImageUrl: null, affiliateUrl: 'https://meli.la/2' },
];

beforeEach(() => vi.resetAllMocks());

it('combines category and search across editorial fields and tags', () => {
  expect(filterPublicProducts(products, 'barista', 'cafe')).toEqual([products[0]]);
  expect(filterPublicProducts(products, 'audio', 'cafe')).toEqual([]);
  expect(filterPublicProducts(products, 'ITALIANA', '')).toEqual([products[0]]);
});

it('renders the filtered result with category, summary and a consistent CTA', async () => {
  mocks.findMany.mockResolvedValue(products);
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ q: 'café', categoria: 'cafe' }) }));
  expect(html).toContain('1 producto encontrado');
  expect(html).toContain('Café en casa');
  expect(html).toContain('Compacta');
  expect(html).toContain('Ver producto');
  expect(html).not.toContain('Auriculares');
});

it('shows a distinct error state when products cannot be loaded', async () => {
  mocks.findMany.mockRejectedValue(new Error('database unavailable'));
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('No pudimos cargar los productos');
  expect(html).toContain('role="alert"');
});
