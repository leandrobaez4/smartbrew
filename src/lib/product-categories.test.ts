import { describe, expect, it } from 'vitest';
import { getProductCategory, PRODUCT_CATEGORIES, PRODUCT_CATEGORY_SLUGS } from './product-categories';

describe('product categories', () => {
  it('exposes the five stable category slugs', () => {
    expect(PRODUCT_CATEGORY_SLUGS).toEqual([
      'cafe',
      'tecnologia',
      'gadgets',
      'smart-home',
      'home-office',
    ]);
    expect(PRODUCT_CATEGORY_SLUGS).toEqual(PRODUCT_CATEGORIES.map(({ slug }) => slug));
  });

  it('resolves known categories and rejects unknown slugs', () => {
    expect(getProductCategory('smart-home')?.name).toBe('Smart Home');
    expect(getProductCategory('unknown')).toBeUndefined();
  });
});
