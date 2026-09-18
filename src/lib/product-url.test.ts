import { expect, it } from 'vitest';
import { productPath, productUrl, safeAffiliateUrl } from './product-url';
it('generates stable public links and encodes path input', () => {
  expect(productUrl('abc')).toBe('https://www.smartbrew.tech/productos/abc');
  expect(productPath('a/b')).toBe('/productos/a%2Fb');
  expect(() => productUrl('abc', 'http://unsafe.test')).toThrow();
});
it('only allows safe Mercado Libre affiliate destinations', () => {
  expect(safeAffiliateUrl('https://meli.la/a')).toBe('https://meli.la/a');
  expect(safeAffiliateUrl('https://www.mercadolibre.com.ar/p/MLA123')).toBeTruthy();
  for (const value of [null, '', 'javascript:alert(1)', 'https://meli.la.evil.test/a', 'https://user:secret@meli.la/a', 'https://evil.test']) expect(safeAffiliateUrl(value)).toBeNull();
});
