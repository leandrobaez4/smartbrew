import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { extractElitProduct } from './extract.mjs';

afterEach(() => {
  delete globalThis.location;
  delete globalThis.document;
});

function nextScript(product) {
  const payload = `f:[[\"$\",\"component\",null,{\"data\":${JSON.stringify(product)}}]]`;
  return { textContent: `self.__next_f.push(${JSON.stringify([1, payload])})` };
}

function page(product, options = {}) {
  globalThis.location = new URL(options.url || 'https://www.elit.com.ar/producto/6358-auricular-logitech-h111-negro');
  const meta = {
    'meta[property="og:title"]': { getAttribute: () => product.name || '' },
    'meta[property="og:image"]': { getAttribute: () => 'https://images.elit.com.ar/p/6358/i/cover_m.webp' },
  };
  globalThis.document = {
    querySelector: (selector) => selector === 'h1' ? { textContent: product.name || '' } : meta[selector] || null,
    querySelectorAll: (selector) => selector === 'script' ? [nextScript(product)] : [],
  };
}

test('extracts the Elit payload, preferring large direct gallery images', () => {
  page({
    _id: 'mongo-id', code: 6358, name: 'Auricular LOGITECH H111 Negro', alfaCode: 'LOGMICH111',
    productCode: '981-000612', ean: 97855114976, description: 'Compatible con ordenadores.',
    brand: { name: 'logitech', title: 'Logitech' }, subCategory: { name: 'Auriculares' },
    price: 25.5, currency: 'USD', currentExchange: 1535, stockTotal: 7, warranty: '12', weightReal: 0.168,
    width: 19.99, height: 22, length: 5.41, vat: 21, billingGroup: 'ELIT',
    media: { images: [
      { s: 'https://images.elit.com.ar/p/6358/i/a_s.webp', l: 'https://images.elit.com.ar/p/6358/i/a_l.webp' },
      { m: 'https://images.elit.com.ar/p/6358/i/b_m.webp' },
    ] },
  });

  const result = extractElitProduct();
  assert.equal(result.ok, true);
  assert.equal(result.product.externalId, '6358');
  assert.equal(result.product.sku, '981-000612');
  assert.equal(result.product.ean, '97855114976');
  assert.equal(result.product.pricing.supplierPriceUsd, 25.5);
  assert.equal(result.product.pricing.exchangeRateArsPerUsd, 1535);
  assert.equal(result.product.pricing.supplierPriceArs, 39142.5);
  assert.equal(result.product.pricing.vatAmountUsd, 5.355);
  assert.equal(result.product.pricing.vatAmountArs, 8219.925);
  assert.equal(result.product.cost, 47362.425);
  assert.equal(result.product.currency, 'ARS');
  assert.equal(result.product.stock, 7);
  assert.deepEqual(result.product.images, [
    'https://images.elit.com.ar/p/6358/i/a_l.webp',
    'https://images.elit.com.ar/p/6358/i/b_m.webp',
  ]);
  assert.deepEqual(result.product.attributes.dimensionsCm, { width: 19.99, height: 22, length: 5.41 });
});

test('reports unavailable price and stock without inventing values', () => {
  page({ _id: 'mongo-id', code: 6358, name: 'Auricular', price: null, stock: null, currency: 2, media: { images: [] } });
  const result = extractElitProduct();
  assert.equal(result.product.pricing.supplierPriceUsd, null);
  assert.equal(result.product.cost, null);
  assert.equal(result.product.currency, null);
  assert.equal(result.product.stock, null);
  assert.match(result.message, /precio ni tipo de cambio ni stock/);
});

test('reads the displayed USD exchange rate and IVA when the payload does not carry them', () => {
  const product = { _id: 'mongo-id', code: 6358, name: 'Auricular', price: 10, media: { images: [] } };
  page(product);
  const originalQuery = document.querySelectorAll;
  document.querySelectorAll = (selector) => selector === 'p' || selector === 'p, small'
    ? [{ textContent: 'USD $1535.00' }, { textContent: '+ IVA 21%' }]
    : originalQuery(selector);
  const result = extractElitProduct();
  assert.equal(result.product.pricing.exchangeRateArsPerUsd, 1535);
  assert.equal(result.product.pricing.vatPercentage, 21);
  assert.equal(result.product.pricing.supplierCostWithVatUsd, 12.1);
  assert.equal(result.product.pricing.supplierCostWithVatArs, 18573.5);
});

test('refuses unrelated origins and non-product pages', () => {
  for (const url of ['https://example.com/producto/6358-test', 'https://www.elit.com.ar/', 'https://www.elit.com.ar.evil.test/producto/6358-test']) {
    page({ name: 'Producto' }, { url });
    assert.equal(extractElitProduct().ok, false);
  }
});

test('does not accept image URLs outside the Elit image host', () => {
  page({
    _id: 'mongo-id', code: 6358, name: 'Auricular',
    media: { images: [{ l: 'https://evil.test/private.png' }] },
  });
  assert.deepEqual(extractElitProduct().product.images, ['https://images.elit.com.ar/p/6358/i/cover_m.webp']);
});
