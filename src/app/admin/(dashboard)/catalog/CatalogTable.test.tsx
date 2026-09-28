import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { CatalogItem } from '@/lib/catalog-read-model';
import type { ProductData } from '../products/ProductTable';

vi.stubGlobal('React', React);
vi.mock('../products/ProductPreviewModal', () => ({ default: () => <div>Modal de previa</div> }));

import CatalogTable from './CatalogTable';

const affiliateItem: CatalogItem = {
  catalogKey: 'affiliate:one', sourceKind: 'AFFILIATE_MARKETPLACE', productId: 'one', title: 'Lámpara',
  externalId: 'MLA123', marketplace: 'MERCADO_LIBRE', affiliateUrl: 'https://meli.la/test', status: 'ACTIVE',
  availability: 'UNKNOWN', price: 10, currency: 'ARS', imageUrl: 'https://example.com/lamp.jpg',
  updatedAt: new Date('2026-09-28T18:00:00Z'), href: '/admin/products/one',
};

const affiliateProduct: ProductData = {
  id: 'one', title: 'Lámpara', externalId: 'MLA123', marketplace: 'MERCADO_LIBRE', status: 'ACTIVE', price: 10,
  currencyId: 'ARS', primaryImageUrl: affiliateItem.imageUrl, originalPermalink: 'https://example.com/product',
  affiliateUrl: 'https://meli.la/test', createdAt: new Date('2026-09-28T18:00:00Z'), isPublished: false,
  instagramPublications: [], instagramBlocked: false, imageUrls: [affiliateItem.imageUrl!],
};

it('shows the affiliate image and restores its preview action', () => {
  const html = renderToStaticMarkup(<CatalogTable items={[affiliateItem]} affiliateProducts={[affiliateProduct]} fromUrl="/admin/catalog" />);
  expect(html).toContain('src="https://example.com/lamp.jpg"');
  expect(html).toContain('alt="Lámpara"');
  expect(html).toContain('Previa');
  expect(html).toContain('href="/admin/products/one"');
});
