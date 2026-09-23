import { describe, expect, it } from 'vitest';
import { getProductCategory, PRODUCT_CATEGORIES } from './product-categories';

describe('product categories', () => {
  it('exposes the five stable category slugs', () => {
    expect(PRODUCT_CATEGORIES.map(({ slug }) => slug)).toEqual([
      'cafe',
      'tecnologia',
      'gadgets',
      'smart-home',
      'home-office',
    ]);
  });

  it('resolves known categories and rejects unknown slugs', () => {
    expect(getProductCategory('smart-home')?.name).toBe('Smart Home');
    expect(getProductCategory('unknown')).toBeUndefined();
  });
});
