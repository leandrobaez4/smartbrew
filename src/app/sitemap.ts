import type { MetadataRoute } from 'next';
import { PrismaClient } from '@prisma/client';
import { PRODUCT_CATEGORIES } from '@/lib/product-categories';
import { productPath } from '@/lib/product-url';
import { absoluteSiteUrl } from '@/lib/site-url';

export const revalidate = 3600;

const db = new PrismaClient();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteSiteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteSiteUrl('/productos'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteSiteUrl('/politica-de-privacidad'), changeFrequency: 'yearly', priority: 0.2 },
    ...PRODUCT_CATEGORIES.map(({ slug }) => ({
      url: absoluteSiteUrl(`/categorias/${slug}`),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];

  try {
    const [products, collections] = await Promise.all([
      db.product.findMany({
        where: { status: 'ACTIVE', affiliateUrl: { not: null } },
        select: { id: true, updatedAt: true, primaryImageUrl: true },
      }),
      db.collection.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true, image: true },
      }),
    ]);

    return [
      ...staticRoutes,
      ...products.map((product) => ({
        url: absoluteSiteUrl(productPath(product.id)),
        lastModified: product.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        images: product.primaryImageUrl?.startsWith('https://') ? [product.primaryImageUrl] : undefined,
      })),
      ...collections.map((collection) => ({
        url: absoluteSiteUrl(`/colecciones/${encodeURIComponent(collection.slug)}`),
        lastModified: collection.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        images: collection.image?.startsWith('https://') ? [collection.image] : undefined,
      })),
    ];
  } catch (error) {
    console.error('Could not load dynamic sitemap entries.', error);
    return staticRoutes;
  }
}
