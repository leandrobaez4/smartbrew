import { it, expect } from 'vitest';
import { isVideoMediaUrl, mergeProductImages } from './product-gallery';
import { parseAffiliateImport } from './affiliate-import-input';
it('merges galleries without deleting previous pictures or duplicating resolutions', () => {
  expect(mergeProductImages(['https://http2.mlstatic.com/D_NQ_NP_123456-MLA123456_012026-O.webp'], ['https://http2.mlstatic.com/D_NQ_NP_2X_123456-MLA123456_012026-F.webp', 'https://http2.mlstatic.com/another.webp'])).toHaveLength(2);
});
it('accepts serialized galleries and rejects unknown hosts or excessive counts', () => {
  const data = { url: 'https://www.mercadolibre.com.ar/p/MLA123', title: 'Test', affiliateUrl: 'https://meli.la/test', image: '' };
  expect(parseAffiliateImport({ ...data, images: '["https://http2.mlstatic.com/a.webp"]' }).images).toHaveLength(1);
  expect(() => parseAffiliateImport({ ...data, images: ['https://evil.test/a'] })).toThrow();
  expect(() => parseAffiliateImport({ ...data, images: Array(21).fill('https://http2.mlstatic.com/a.webp') })).toThrow();
});
it('keeps video URLs out of product galleries while preserving image URLs', () => {
  expect(isVideoMediaUrl('https://http2.mlstatic.com/demo.MP4?token=1')).toBe(true);
  expect(isVideoMediaUrl('https://http2.mlstatic.com/photo.jpg?format=webp')).toBe(false);
  expect(mergeProductImages([
    'https://http2.mlstatic.com/demo.mp4',
    'https://http2.mlstatic.com/photo.jpg',
    'https://http2.mlstatic.com/demo.webm?download=1',
  ])).toEqual(['https://http2.mlstatic.com/photo.jpg']);
});
