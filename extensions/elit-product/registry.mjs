import { extractElitProduct } from './extractors/elit.mjs';
import { extractUnidropProduct } from './extractors/unidrop.mjs';

export const productSources = Object.freeze([
  Object.freeze({
    slug: 'elit',
    label: 'Elit',
    reviewPath: '/admin/suppliers/elit-import',
    matches: (url) => url.origin === 'https://www.elit.com.ar' || url.origin === 'https://elit.com.ar'
      ? /^\/producto\/\d+(?:[-/]|$)/.test(url.pathname)
      : false,
    extractor: extractElitProduct,
  }),
  Object.freeze({
    slug: 'unidrop',
    label: 'Unidrop',
    reviewPath: '/admin/suppliers/import',
    matches: (url) => url.origin === 'https://www.unidrop.com.ar' || url.origin === 'https://unidrop.com.ar'
      ? /^\/panel\/catalogue\/\d+(?:\/|$)/.test(url.pathname)
      : false,
    extractor: extractUnidropProduct,
  }),
]);

export function resolveProductSource(value) {
  try {
    const url = new URL(value);
    return productSources.find((source) => source.matches(url)) || null;
  } catch {
    return null;
  }
}
