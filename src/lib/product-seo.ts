import type { Metadata } from 'next';
import { mergeProductImages } from './product-gallery';
import { productPath } from './product-url';
import { absoluteSiteUrl } from './site-url';

export type SeoProduct = {
  id: string;
  title: string;
  originalTitle: string | null;
  originalDescription: string | null;
  displayTitle: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  price: unknown;
  currencyId: string | null;
  affiliateUrl: string | null;
  primaryImageUrl: string | null;
  imageUrls: string[];
  category: string | null;
  externalId: string | null;
};

const clean = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() || '';

export function productDisplayTitle(product: SeoProduct) {
  return clean(product.displayTitle) || clean(product.originalTitle) || clean(product.title);
}

export function productSeoDescription(product: SeoProduct) {
  const description = clean(product.seoDescription)
    || clean(product.shortDescription)
    || clean(product.description)
    || clean(product.originalDescription)
    || `Conocé ${productDisplayTitle(product)}, seleccionado por SmartBrew por su utilidad y experiencia de uso.`;
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}...` : description;
}

export function buildProductMetadata(product: SeoProduct): Metadata {
  const displayTitle = productDisplayTitle(product);
  const title = clean(product.seoTitle) || `${displayTitle} | SmartBrew`;
  const description = productSeoDescription(product);
  const canonical = productPath(product.id);
  const images = mergeProductImages(
    product.primaryImageUrl ? [product.primaryImageUrl] : [],
    product.imageUrls,
  );

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      images: images.map((url) => ({ url, alt: displayTitle })),
    },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}

export function buildProductStructuredData(product: SeoProduct) {
  const name = productDisplayTitle(product);
  const description = productSeoDescription(product);
  const images = mergeProductImages(
    product.primaryImageUrl ? [product.primaryImageUrl] : [],
    product.imageUrls,
  );
  const price = Number(product.price);
  const hasOffer = Number.isFinite(price) && price >= 0 && Boolean(product.currencyId && product.affiliateUrl);
  const categoryName = clean(product.category);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${absoluteSiteUrl(productPath(product.id))}#product`,
        name,
        description,
        url: absoluteSiteUrl(productPath(product.id)),
        image: images,
        ...(product.externalId ? { sku: product.externalId } : {}),
        ...(categoryName ? { category: categoryName } : {}),
        ...(hasOffer ? {
          offers: {
            '@type': 'Offer',
            url: product.affiliateUrl,
            price,
            priceCurrency: product.currencyId,
            seller: { '@type': 'Organization', name: 'Mercado Libre' },
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Inicio', item: absoluteSiteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Productos', item: absoluteSiteUrl('/productos') },
          { '@type': 'ListItem', position: 3, name, item: absoluteSiteUrl(productPath(product.id)) },
        ],
      },
    ],
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
