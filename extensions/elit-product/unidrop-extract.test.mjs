import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUnidropProduct } from './extractors/unidrop.mjs';

afterEach(() => {
  delete globalThis.location;
  delete globalThis.document;
});

const element = (textContent, extra = {}) => ({ textContent, ...extra });
const priceLabel = (label, value) => element(label, { parentElement: { querySelector: () => element(value) } });
const row = (label, value) => ({
  querySelector: () => element(label),
  querySelectorAll: () => [element(label), element(value)],
});
const feature = (label, value) => ({
  textContent: `${label}: ${value}`,
  querySelector: () => element(`${label}:`),
});

function page(options = {}) {
  globalThis.location = new URL(options.url || 'https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3');
  const description = element(options.description ?? 'Mantén tu escritorio limpio.');
  const featureList = { querySelectorAll: () => options.features ?? [feature('Color', 'Negro')] };
  const h3 = [
    element(options.descriptionLabel ?? 'Descripción', { nextElementSibling: description }),
    element(options.featuresLabel ?? 'Características', { nextElementSibling: featureList }),
  ];
  const paragraphs = options.paragraphs ?? [
    element('MINASPGATITO: stock 40'),
    element('Si lo vendés en Tienda Nube, te cobramos $ 9.999,99', { querySelector: () => element('$ 9.999,99') }),
  ];
  const spans = options.spans ?? [
    priceLabel(options.costLabel ?? 'Precio de mercancía', '$ 14.169,00'),
    priceLabel(options.profitLabel ?? 'Precio con ganancía', '$ 14.169,00'),
  ];
  const images = options.images ?? [
    { currentSrc: 'https://api.unidrop.com.ar/catalog-img/1108.jpg' },
    { currentSrc: 'https://evil.test/private.jpg' },
  ];
  const main = {
    querySelector: (selector) => selector === 'h1'
      ? element(options.title ?? 'MINI ASPIRADORA DE ESCRITORIO -')
      : selector === 'h5' ? element('HOGAR') : null,
    querySelectorAll: (selector) => ({
      p: paragraphs,
      span: spans,
      h3,
      tr: options.rows ?? [row('PESO', '270 g'), row('ALTURA', '9 cm'), row('ANCHO', '9 cm'), row('PROFUNDIDAD', '10 cm')],
      'img[alt^="main-"]': images,
    })[selector] ?? [],
  };
  globalThis.document = { querySelector: (selector) => selector === 'main' ? main : null };
}

test('extracts product 398 into one safe snapshot per sellable variant', () => {
  page();
  const result = extractUnidropProduct();
  assert.equal(result.ok, true);
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.product, {
    version: 1,
    supplier: 'unidrop',
    sourceProductId: '398',
    externalId: '398:MINASPGATITO',
    sku: 'MINASPGATITO',
    ean: null,
    title: 'MINI ASPIRADORA DE ESCRITORIO',
    description: 'Mantén tu escritorio limpio.',
    brand: null,
    category: 'HOGAR',
    costArs: 14_169,
    priceWithProfitArs: 14_169,
    stock: 40,
    images: ['https://api.unidrop.com.ar/catalog-img/1108.jpg'],
    package: { weightGrams: 270, heightCm: 9, widthCm: 9, lengthCm: 10 },
    shippingReference: { platform: 'TIENDANUBE', amountArs: 9_999.99 },
    attributes: { Color: 'Negro' },
    sourceUrl: 'https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3',
    capturedAt: result.product.capturedAt,
  });
  assert.match(result.product.capturedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('does not invent mandatory data when the authenticated DOM is partial', () => {
  page({ paragraphs: [], spans: [] });
  const result = extractUnidropProduct();
  assert.equal(result.ok, false);
  assert.match(result.message, /SKU y stock/);
  assert.match(result.message, /precio de mercancía/);
});

test('tolerates capitalization, accents and alternate visible labels', () => {
  page({
    costLabel: ' PRECIO MERCADERÍA ',
    profitLabel: 'Precio con ganancia',
    descriptionLabel: 'DESCRIPCIÓN',
    featuresLabel: 'CARACTERÍSTICAS',
  });
  const result = extractUnidropProduct();
  assert.equal(result.ok, true);
  assert.equal(result.product.costArs, 14_169);
  assert.equal(result.product.priceWithProfitArs, 14_169);
  assert.equal(result.product.description, 'Mantén tu escritorio limpio.');
});

test('returns separate identities for multiple variants and requires selection', () => {
  page({ paragraphs: [element('NEGRO: stock 4'), element('BLANCO: stock 2')] });
  const result = extractUnidropProduct();
  assert.equal(result.product, null);
  assert.deepEqual(result.products.map((product) => product.externalId), ['398:NEGRO', '398:BLANCO']);
  assert.match(result.message, /Elegí una variante/);
});

test('refuses unrelated origins and catalogue list pages', () => {
  for (const url of ['https://example.com/panel/catalogue/398', 'https://www.unidrop.com.ar/panel/catalogue']) {
    page({ url });
    assert.equal(extractUnidropProduct().ok, false);
  }
});
