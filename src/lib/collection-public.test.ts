import { describe, expect, it } from 'vitest';
import { buildCollectionMetadata, collectionPath, safeCollectionImage } from './collection-public';

const collection = {
  slug: 'setup-home-office',
  title: 'Setup home office',
  description: 'Ideas para trabajar mejor.',
  seoTitle: null,
  seoDescription: null,
  image: 'https://images.example.com/office.jpg',
};

describe('public collection helpers', () => {
  it('builds a canonical path and complete social metadata', () => {
    expect(collectionPath(collection.slug)).toBe('/colecciones/setup-home-office');
    expect(buildCollectionMetadata(collection)).toMatchObject({
      title: 'Setup home office | SmartBrew',
      description: 'Ideas para trabajar mejor.',
      alternates: { canonical: '/colecciones/setup-home-office' },
      openGraph: {
        url: '/colecciones/setup-home-office',
        images: [{ url: 'https://images.example.com/office.jpg', alt: 'Setup home office' }],
      },
    });
  });

  it('uses explicit SEO copy when configured', () => {
    const metadata = buildCollectionMetadata({ ...collection, seoTitle: 'La mejor oficina', seoDescription: 'Selección SEO.' });
    expect(metadata.title).toBe('La mejor oficina');
    expect(metadata.description).toBe('Selección SEO.');
  });

  it('rejects unsafe image URLs', () => {
    expect(safeCollectionImage('http://images.example.com/a.jpg')).toBeNull();
    expect(safeCollectionImage('https://user:secret@example.com/a.jpg')).toBeNull();
    expect(safeCollectionImage('https://images.example.com/a.jpg')).toBe('https://images.example.com/a.jpg');
  });
});

