import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), notFound: vi.fn(() => { throw Error('404'); }) }));
vi.mock('@prisma/client', () => ({ PrismaClient: class { product = { findMany: mocks.findMany }; } }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/lib/product-categories', async () => await import('../../../lib/product-categories'));
vi.mock('@/lib/product-url', async () => await import('../../../lib/product-url'));
vi.mock('@/app/productos/ProductGrid', async () => await import('../../productos/ProductGrid'));

import Page, { generateMetadata, generateStaticParams } from './page';

beforeEach(() => vi.resetAllMocks());

it('declares every supported category as a stable route', () => {
  expect(generateStaticParams()).toEqual([
    { slug: 'cafe' },
    { slug: 'tecnologia' },
    { slug: 'gadgets' },
    { slug: 'smart-home' },
    { slug: 'home-office' },
  ]);
});

it('filters active public products by the current category', async () => {
  mocks.findMany.mockResolvedValue([{ id: 'p1', title: 'Cafetera', displayTitle: null, primaryImageUrl: null, affiliateUrl: 'https://meli.la/a' }]);
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: 'cafe' }) }));
  expect(html).toContain('<h1>Café</h1>');
  expect(html).toContain('Cafetera');
  expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { category: 'cafe', status: 'ACTIVE', affiliateUrl: { not: null } },
  }));
});

it('creates category-specific canonical and Open Graph metadata', async () => {
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'home-office' }) });
  expect(metadata.alternates).toEqual({ canonical: '/categorias/home-office' });
  expect(metadata.openGraph).toEqual(expect.objectContaining({ url: '/categorias/home-office' }));
});

it('keeps the category page available when the database is temporarily unavailable', async () => {
  mocks.findMany.mockRejectedValue(new Error('database unavailable'));
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug: 'gadgets' }) }));
  expect(html).toContain('<h1>Gadgets</h1>');
  expect(html).toContain('Estamos preparando una nueva selección');
});

it('returns 404 for an unknown category', async () => {
  await expect(Page({ params: Promise.resolve({ slug: 'unknown' }) })).rejects.toThrow('404');
});
