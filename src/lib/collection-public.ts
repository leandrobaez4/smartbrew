import type { Metadata } from 'next';

export type PublicCollectionMetadata = {
  slug: string;
  title: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  image: string | null;
};

export function collectionPath(slug: string) {
  return `/colecciones/${encodeURIComponent(slug)}`;
}

export function safeCollectionImage(value: string | null) {
  try {
    const url = new URL(value || '');
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function buildCollectionMetadata(collection: PublicCollectionMetadata): Metadata {
  const title = collection.seoTitle || `${collection.title} | SmartBrew`;
  const description = collection.seoDescription || collection.description || `Descubrí la selección ${collection.title} de SmartBrew.`;
  const canonical = collectionPath(collection.slug);
  const image = safeCollectionImage(collection.image);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      images: image ? [{ url: image, alt: collection.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

