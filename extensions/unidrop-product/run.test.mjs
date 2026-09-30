import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canConfigureProduct, createImportCommand, extractCurrentProduct } from './run.mjs';

const deadlines = { tab: 10, extraction: 10 };

test('builds an Unidrop command for the selected SKU', () => {
  const product = { supplier: 'unidrop', externalId: '398:MINASPGATITO', sku: 'MINASPGATITO', title: 'Mini aspiradora' };
  assert.equal(canConfigureProduct(product), true);
  assert.deepEqual(createImportCommand(product), {
    version: 1,
    command: 'IMPORT_SUPPLIER_PRODUCT',
    supplierSlug: 'unidrop',
    externalId: '398:MINASPGATITO',
    snapshot: product,
  });
});

test('requires a selected SKU before configuring SmartBrew', () => {
  assert.equal(canConfigureProduct({ externalId: '398', title: 'Mini aspiradora' }), false);
  assert.throws(() => createImportCommand({ externalId: '398', title: 'Mini aspiradora' }), /variante/);
});

test('extracts only from an active Unidrop catalogue item', async () => {
  let executed;
  const chrome = {
    tabs: { query: async () => [{ id: 77, url: 'https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3' }] },
    scripting: { executeScript: async (options) => {
      executed = options;
      return [{ result: { ok: true, product: null, products: [{ externalId: '398:SKU', sku: 'SKU', title: 'Producto' }], message: 'Listo' } }];
    } },
  };
  const response = await extractCurrentProduct(chrome, () => {}, deadlines);
  assert.equal(response.products[0].sku, 'SKU');
  assert.deepEqual(executed.target, { tabId: 77 });
  assert.equal(executed.world, 'ISOLATED');
});

test('refuses Elit and unrelated tabs without injecting code', async () => {
  for (const url of ['https://www.elit.com.ar/producto/6358-producto', 'https://example.com/panel/catalogue/398']) {
    let injected = false;
    const chrome = {
      tabs: { query: async () => [{ id: 42, url }] },
      scripting: { executeScript: async () => { injected = true; } },
    };
    await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /Unidrop/);
    assert.equal(injected, false);
  }
});

test('stops waiting when Chrome does not return extraction results', async () => {
  const chrome = {
    tabs: { query: async () => [{ id: 77, url: 'https://unidrop.com.ar/panel/catalogue/398' }] },
    scripting: { executeScript: () => new Promise(() => {}) },
  };
  await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /no devolvió los datos/);
});
