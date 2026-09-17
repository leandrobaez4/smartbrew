import { expect, it } from 'vitest';
import { parseProductSort, parseSortDirection, productListQuery } from './product-list';

it('accepts only supported sort parameters', () => {
  expect(parseProductSort('affiliate')).toBe('affiliate');
  expect(parseProductSort('DROP TABLE')).toBe('createdAt');
  expect(parseSortDirection('asc')).toBe('asc');
  expect(parseSortDirection('invalid')).toBe('desc');
});
it('sorts by link presence instead of URL text before pagination', () => {
  const query = productListQuery('', '', 'affiliate', 'desc', 20, 20);
  expect(query.sql).toContain('LENGTH(TRIM(COALESCE');
  expect(query.sql).toContain('DESC, p.id ASC');
  expect(query.sql.indexOf('ORDER BY')).toBeLessThan(query.sql.indexOf('LIMIT'));
  expect(query.values.slice(-2)).toEqual([20, 20]);
});
it('counts only live Instagram publications for sorting', () => {
  const query = productListQuery('', '', 'instagram', 'asc', 0, 20);
  expect(query.sql).toContain("pub.platform = 'INSTAGRAM'");
  expect(query.sql).toContain("pub.status = 'PUBLISHED'");
  expect(query.sql).toContain('pub."deletedAt" IS NULL');
});
it('parameterizes filters and pagination', () => {
  const search = "' OR TRUE --";
  const query = productListQuery(search, 'ACTIVE', 'title', 'asc', 40, 20);
  expect(query.sql).not.toContain(search);
  expect(query.values).toContain(`%${search}%`);
  expect(query.values).toContain('ACTIVE');
  expect(query.sql).toContain('LOWER(p.title) ASC, p.id ASC');
});
