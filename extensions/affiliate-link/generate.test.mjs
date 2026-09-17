import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProduct, withDeadline } from './generate.mjs';

const success = { ok: true, link: 'https://meli.la/test', message: 'Listo', product: { title: 'Reloj', url: 'https://www.mercadolibre.com.ar/p/MLA123', image: 'https://http2.mlstatic.com/a.webp' } };
const deadlines = { tab: 10, request: 10, gallery: 10 };
function mockChrome(request, gallery) {
  let calls = 0;
  return { tabs: { query: async () => [{ id: 1, url: success.product.url }] }, scripting: { executeScript: () => (++calls === 1 ? request() : gallery()) } };
}
test('stops waiting when Chrome never answers', async () => {
  const chrome = mockChrome(() => new Promise(() => {}), () => []);
  await assert.rejects(generateProduct(chrome, () => {}, deadlines), /podría haberse procesado/);
});
test('keeps the generated link and cover when gallery hangs', async () => {
  const chrome = mockChrome(async () => [{ result: success }], () => new Promise(() => {}));
  const result = await generateProduct(chrome, () => {}, deadlines);
  assert.equal(result.link, success.link);
  assert.deepEqual(result.images, [success.product.image]);
  assert.match(result.warning, /galería/);
});
test('keeps generated link when Chrome fails injecting gallery', async () => {
  const chrome = mockChrome(async () => [{ result: success }], async () => { throw Error('tab closed'); });
  assert.equal((await generateProduct(chrome, () => {}, deadlines)).link, success.link);
});
test('reports each stage and includes collected photos', async () => {
  const stages = [];
  const chrome = mockChrome(async () => [{ result: success }], async () => [{ result: ['https://http2.mlstatic.com/b.webp'] }]);
  const result = await generateProduct(chrome, message => stages.push(message), deadlines);
  assert.equal(stages.length, 3);
  assert.deepEqual(result.images, ['https://http2.mlstatic.com/b.webp']);
});
test('reports API errors without attempting gallery collection or retrying', async () => {
  const chrome = mockChrome(async () => [{ result: { ok: false, message: 'HTTP 403' } }], () => { assert.fail('should not run'); });
  await assert.rejects(generateProduct(chrome, () => {}, deadlines), /403/);
});
test('times out the initial tab query', async () => {
  await assert.rejects(generateProduct({ tabs: { query: () => new Promise(() => {}) } }, () => {}, deadlines), /consultar la pestaña/);
});
test('ignores late results after a deadline, without retrying the task', async () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  await assert.rejects(withDeadline(promise, 1, 'timeout'), /timeout/);
  resolve('late result');
});
