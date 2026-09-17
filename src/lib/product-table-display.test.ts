import { expect, it } from 'vitest';
import { formatProductCreation, paginationPages } from './product-table-display';
import { parseProductSort, parseSortDirection, productListQuery } from './product-list';

it('defaults to latest creation first across the entire result set', () => {
  const query = productListQuery('', '', parseProductSort(), parseSortDirection(), 0, 20);
  expect(query.sql).toContain('ORDER BY p."createdAt" DESC, p.id ASC');
});
it('shows first, last, current and neighboring pages without duplicates', () => {
  expect(paginationPages(1, 1)).toEqual([1]);
  expect(paginationPages(1, 10)).toEqual([1, 2, 10]);
  expect(paginationPages(5, 10)).toEqual([1, 4, 5, 6, 10]);
  expect(paginationPages(10, 10)).toEqual([1, 9, 10]);
});
it('formats the creation day consistently in Argentina, including near midnight UTC', () => {
  expect(formatProductCreation('2026-09-18T01:00:00Z')).toBe('17/09/2026');
});
