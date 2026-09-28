import { afterEach, describe, expect, it } from 'vitest';
import {
  buildProductMetadata,
  buildProductStructuredData,
  productSeoDescription,
  serializeStructuredData,
  type SeoProduct,
} from './product-seo';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

const product: SeoProduct = {
  id: 'product-1',
  externalId: 'MLA123',
  title: 'Nombre original',
  originalTitle: null,
  originalDescription: null,
  displayTitle: 'Auriculares inalámbricos',
  shortDescription: 'Auriculares seleccionados para trabajar y escuchar música.',
  description: null,
  seoTitle: null,
  seoDescription: null,
  price: 25_000,
  currencyId: 'ARS',
  affiliateUrl: 'https://www.mercadolibre.com.ar/producto',
  primaryImageUrl: 'https://http2.mlstatic.com/product.jpg',
  imageUrls: [],
  category: 'tecnologia',
};

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

describe('product SEO', () => {
  it('builds unique canonical and social metadata from editorial content', () => {
    expect(buildProductMetadata(product)).toMatchObject({
      title: 'Auriculares inalámbricos | SmartBrew',
      description: product.shortDescription,
      alternates: { canonical: '/productos/product-1' },
      openGraph: {
        url: '/productos/product-1',
        images: [{ url: product.primaryImageUrl, alt: 'Auriculares inalámbricos' }],
      },
    });
  });

  it('publishes accurate Product, Offer and breadcrumb structured data', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.smartbrew.tech';
    const data = buildProductStructuredData(product);
    expect(data['@graph'][0]).toMatchObject({
      '@type': 'Product',
      name: 'Auriculares inalámbricos',
      sku: 'MLA123',
      offers: { '@type': 'Offer', price: 25_000, priceCurrency: 'ARS' },
    });
    expect(data['@graph'][1]).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [{ position: 1 }, { position: 2 }, { position: 3 }],
    });
  });

  it('limits descriptions and escapes markup in serialized JSON-LD', () => {
    const unsafe = { ...product, seoDescription: `<script>${'a'.repeat(200)}</script>` };
    expect(productSeoDescription(unsafe).length).toBeLessThanOrEqual(160);
    expect(serializeStructuredData(buildProductStructuredData(unsafe))).not.toContain('<script>');
  });
});
