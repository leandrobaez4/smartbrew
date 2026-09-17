import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { collectProductGallery } from './gallery.mjs';
afterEach(() => { delete globalThis.location; delete globalThis.document; });
const small = 'https://http2.mlstatic.com/D_NQ_NP_123456-MLA123456789_012026-O.webp';
const large = 'https://http2.mlstatic.com/D_NQ_NP_2X_123456-MLA123456789_012026-F.webp';
const second = 'https://http2.mlstatic.com/D_NQ_NP_654321-MLA987654321_012026-O.webp';
test('chooses largest srcset candidate, deduplicates photo variants, excludes unrelated images', () => {
  globalThis.location = new URL('https://www.mercadolibre.com.ar/p/MLA123');
  globalThis.document = {
    querySelector: () => ({ content: small }),
    querySelectorAll: selector => {
      assert.ok(selector.includes('.ui-pdp-gallery'));
      assert.notEqual(selector, 'img');
      return [
        { src: small, naturalWidth: 100, getAttribute: key => key === 'srcset' ? `${small} 320w, ${large} 1200w` : null },
        { src: second, naturalWidth: 800, getAttribute: () => null },
        { src: 'https://evil.test/image', getAttribute: () => null },
      ];
    },
  };
  assert.deepEqual(collectProductGallery(), [large, second]);
});
test('does not collect outside Mercado Libre', () => {
  globalThis.location = new URL('https://example.com');
  assert.deepEqual(collectProductGallery(), []);
});
