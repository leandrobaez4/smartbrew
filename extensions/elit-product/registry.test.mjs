import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductSource } from './registry.mjs';

test('resolves Elit and Unidrop product URLs through the provider registry', () => {
  assert.equal(resolveProductSource('https://www.elit.com.ar/producto/6358-auricular')?.slug, 'elit');
  assert.equal(resolveProductSource('https://www.unidrop.com.ar/panel/catalogue/398?fromPage=3')?.slug, 'unidrop');
});

test('rejects unsupported hosts and non-product paths', () => {
  assert.equal(resolveProductSource('https://example.com/producto/6358'), null);
  assert.equal(resolveProductSource('https://www.elit.com.ar/mi-cuenta'), null);
  assert.equal(resolveProductSource('https://www.unidrop.com.ar/panel/catalogue'), null);
  assert.equal(resolveProductSource('not-a-url'), null);
});
