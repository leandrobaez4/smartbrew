import { expect, it } from 'vitest';
import { createProductSlug } from './product-slug';

it('creates a readable stable slug with marketplace identity', () => {
  expect(createProductSlug('Cafetera Éspresso Modelo X', 'MLA-123')).toBe('cafetera-espresso-modelo-x-mla-123');
});

it('keeps the generated slug within a practical URL length', () => {
  expect(createProductSlug('Producto '.repeat(30), 'MLAU123456789')).toHaveLength(85);
});
