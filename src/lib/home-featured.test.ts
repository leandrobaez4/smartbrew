import { describe, expect, it } from 'vitest';
import {
  HOME_FEATURED_COLLECTION_SLUG,
  HOME_FEATURED_PRODUCT_LIMIT,
  loadHomeFeaturedProducts,
  selectHomeFeaturedProducts,
} from './home-featured';

const product = (id: string, affiliateUrl = `https://www.mercadolibre.com.ar/${id}`) => ({
  id,
  title: `Producto ${id}`,
  affiliateUrl,
});

describe('home featured products', () => {
  it('uses the editorial collection slug managed from admin', () => {
    expect(HOME_FEATURED_COLLECTION_SLUG).toBe('recomendados-smartbrew');
  });

  it('preserves editorial order, excludes unsafe links and caps the homepage at eight products', () => {
    const products = [
      product('1'),
      product('unsafe', 'javascript:alert(1)'),
      ...Array.from({ length: 10 }, (_, index) => product(String(index + 2))),
    ];

    const result = selectHomeFeaturedProducts(products);

    expect(result).toHaveLength(HOME_FEATURED_PRODUCT_LIMIT);
    expect(result.map(({ id }) => id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('keeps the public homepage available when the editorial query is unavailable', async () => {
    await expect(loadHomeFeaturedProducts(async () => {
      throw new Error('database unavailable');
    })).resolves.toEqual([]);
  });
});
