import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
vi.stubGlobal('React', React);
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('./actions', () => ({ publishToInstagramAction: vi.fn(), unpublishFromInstagramAction: vi.fn(), verifyInstagramPublicationAction: vi.fn(), updateProductStatusAction: vi.fn(), reconcileInstagramPublicationAction: vi.fn(), inspectFacebookInstagramAction: vi.fn() }));
vi.mock('./affiliate-actions', () => ({ updateAffiliateUrlAction: vi.fn() }));
vi.mock('./queue-actions', () => ({ enqueueInstagramProductsAction: vi.fn() }));
vi.mock('./[id]/actions', () => ({ checkAvailability: vi.fn() }));
vi.mock('@/lib/publication-client', () => ({ runPublicationAction: vi.fn() }));
import ProductPreviewModal from './ProductPreviewModal';
import type { ProductData } from './ProductTable';

const product: ProductData = {
  id: 'one', title: 'Lámpara', externalId: 'MLA123', marketplace: 'MERCADOLIBRE', status: 'ACTIVE',
  price: 10, currencyId: 'ARS', primaryImageUrl: null, originalPermalink: 'https://example.com',
  affiliateUrl: 'https://meli.la/test', createdAt: new Date(), isPublished: false,
  instagramBlocked: false, instagramPublications: [], imageUrls: [],
};
const render = (changes: Partial<ProductData> = {}) => renderToStaticMarkup(
  <ProductPreviewModal product={{ ...product, ...changes }} onClose={() => {}} />
);
it('shows published state and reconciliation on first opening, never a publish button', () => {
  const html = render({ isPublished: true, instagramPublications: [{ id: 'publication', mediaId: '123' }] });
  expect(html).toContain('IG Activo');
  expect(html).toContain('Verificar en IG');
  expect(html).toContain('Conciliar registro de Instagram');
  expect(html).not.toContain('Encolar publicación en Instagram');
});
it('blocks queued products and includes edit functionality', () => {
  const html = render({ queueStatus: 'STARTED' });
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?En cola \/ procesando/);
  expect(html).toContain('Verificar cuenta');
  expect(html).toContain('Guardar y Activar');
});
it('shows a new product without stale publication or reconciliation', () => {
  render({ isPublished: true, instagramPublications: [{ id: 'old', mediaId: '123' }] });
  const html = render({ id: 'two' });
  expect(html).not.toContain('IG Activo');
  expect(html).not.toContain('Conciliar registro');
  expect(html).toContain('Encolar publicación en Instagram');
  expect(html).toContain('Configurá el enlace de afiliado y la imagen');
});
