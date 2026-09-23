import { describe, expect, it } from 'vitest';
import { reorderedProductIds } from './collection-order';

describe('reorderedProductIds', () => {
  it('moves a product up without mutating the input', () => {
    const input = ['a', 'b', 'c'];
    expect(reorderedProductIds(input, 'b', 'up')).toEqual(['b', 'a', 'c']);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it('moves a product down', () => {
    expect(reorderedProductIds(['a', 'b', 'c'], 'b', 'down')).toEqual(['a', 'c', 'b']);
  });

  it('keeps boundary and missing products unchanged', () => {
    expect(reorderedProductIds(['a', 'b'], 'a', 'up')).toEqual(['a', 'b']);
    expect(reorderedProductIds(['a', 'b'], 'b', 'down')).toEqual(['a', 'b']);
    expect(reorderedProductIds(['a', 'b'], 'c', 'up')).toEqual(['a', 'b']);
  });
});

