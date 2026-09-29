import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canConfigureProduct, createImportCommand, extractCurrentProduct } from './run.mjs';

const deadlines = { tab: 10, extraction: 10 };

test('allows configuration when pricing must be completed in SmartBrew', () => {
  assert.equal(canConfigureProduct({ externalId: '6358', title: 'Auricular', pricing: {
    supplierPriceUsd: null,
    exchangeRateArsPerUsd: null,
  } }), true);
});

test('builds a versioned command for the shared supplier import pipeline', () => {
  const product = { supplier: 'elit', externalId: '6358', title: 'Auricular' };
  assert.deepEqual(createImportCommand(product, 'elit'), {
    version: 1,
    command: 'IMPORT_SUPPLIER_PRODUCT',
    supplierSlug: 'elit',
    externalId: '6358',
    snapshot: product,
  });
});

test('extracts from the active Elit product tab and reports both stages', async () => {
  const stages = [];
  const chrome = {
    tabs: { query: async () => [{ id: 42, url: 'https://www.elit.com.ar/producto/6358-producto' }] },
    scripting: { executeScript: async (options) => {
      assert.deepEqual(options.target, { tabId: 42 });
      assert.equal(options.world, 'ISOLATED');
      return [{ result: { ok: true, product: { externalId: '6358' }, message: 'Listo' } }];
    } },
  };
  const result = await extractCurrentProduct(chrome, (message) => stages.push(message), deadlines);
  assert.equal(result.product.externalId, '6358');
  assert.deepEqual(result.source, { slug: 'elit', label: 'Elit', reviewPath: '/admin/suppliers/elit-import' });
  assert.equal(stages.length, 2);
});

test('refuses unrelated tabs before injecting code', async () => {
  let injected = false;
  const chrome = {
    tabs: { query: async () => [{ id: 42, url: 'https://example.com/producto/6358' }] },
    scripting: { executeScript: async () => { injected = true; } },
  };
  await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /Elit o Unidrop/);
  assert.equal(injected, false);
});

test('selects the Unidrop extractor without granting persistent host access', async () => {
  let executed;
  const chrome = {
    tabs: { query: async () => [{ id: 77, url: 'https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3' }] },
    scripting: { executeScript: async (options) => {
      executed = options;
      return [{ result: { ok: false, message: 'Extractor pendiente' } }];
    } },
  };
  await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /Extractor pendiente/);
  assert.deepEqual(executed.target, { tabId: 77 });
  assert.equal(executed.world, 'ISOLATED');
});

test('requires a safe provider slug in the common import command', () => {
  const product = { externalId: '398:MINASPGATITO', title: 'Mini aspiradora' };
  assert.throws(() => createImportCommand(product), /identificar el proveedor/);
  assert.equal(createImportCommand(product, 'unidrop').supplierSlug, 'unidrop');
});

test('stops waiting when Chrome does not return extraction results', async () => {
  const chrome = {
    tabs: { query: async () => [{ id: 42, url: 'https://elit.com.ar/producto/6358-producto' }] },
    scripting: { executeScript: () => new Promise(() => {}) },
  };
  await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /no devolvió los datos/);
});
