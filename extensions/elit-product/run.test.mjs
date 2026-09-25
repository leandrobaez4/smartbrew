import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCurrentProduct } from './run.mjs';

const deadlines = { tab: 10, extraction: 10 };

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
  assert.equal(stages.length, 2);
});

test('refuses unrelated tabs before injecting code', async () => {
  let injected = false;
  const chrome = {
    tabs: { query: async () => [{ id: 42, url: 'https://example.com/producto/6358' }] },
    scripting: { executeScript: async () => { injected = true; } },
  };
  await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /elit\.com\.ar/);
  assert.equal(injected, false);
});

test('stops waiting when Chrome does not return extraction results', async () => {
  const chrome = {
    tabs: { query: async () => [{ id: 42, url: 'https://elit.com.ar/producto/6358-producto' }] },
    scripting: { executeScript: () => new Promise(() => {}) },
  };
  await assert.rejects(extractCurrentProduct(chrome, () => {}, deadlines), /no devolvió los datos/);
});
