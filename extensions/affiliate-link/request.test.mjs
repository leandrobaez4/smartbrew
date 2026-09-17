import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requestAffiliateLink } from './request.mjs';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete globalThis.location;
  delete globalThis.document;
  delete globalThis.__smartbrewAffiliateBusy;
});
function product() {
  globalThis.document = { querySelector: selector => selector === 'h1' ? { textContent: 'Reloj' } : null };
  globalThis.location = new URL('https://www.mercadolibre.com.ar/reloj/p/MLA2060255349');
}
test('sends the exact product and tag with same-origin credentials', async () => {
  product();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/affiliate-program/api/v2/stripe/user/links');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), { url: location.href, tag: 'leandrobaez1983' });
    return Response.json({ result: { link: 'https://meli.la/2CDEmi2' }, private: 'do-not-expose' });
  };
  const result = await requestAffiliateLink();
  assert.equal(result.link, 'https://meli.la/2CDEmi2');
  assert.equal(JSON.stringify(result).includes('do-not-expose'), false);
});
test('refuses unrelated origins and non-product pages', async () => {
  globalThis.fetch = () => { throw Error('must not request'); };
  for (const url of ['https://example.com/p/MLA123', 'https://www.mercadolibre.com.ar/', 'https://www.mercadolibre.com.ar.evil.test/p/MLA123']) {
    globalThis.location = new URL(url);
    assert.equal((await requestAffiliateLink()).ok, false);
  }
});
test('reports 403 without exposing response or retrying', async () => {
  product(); let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('secret', { status: 403 }); };
  const result = await requestAffiliateLink();
  assert.equal(result.ok, false);
  assert.match(result.message, /403/);
  assert.equal(calls, 1);
});
test('accepts /up/MLAU product URLs and submits the original URL', async () => {
  product();
  globalThis.location = new URL('https://www.mercadolibre.com.ar/balanza-barista-digital-cafe-tiny-s-temporizador-precision/up/MLAU389769541#wid=MLA1817740204&sid=search');
  let calls = 0;
  globalThis.fetch = async (_, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).url, location.href);
    return Response.json({ link: 'https://meli.la/test' });
  };
  assert.equal((await requestAffiliateLink()).ok, true);
  assert.equal(calls, 1);
});
test('rejects malformed product IDs without sending a request', async () => {
  globalThis.fetch = () => { assert.fail('must not request'); };
  for (const path of ['/up/MLAU', '/up/MLAU123garbage', '/p/MLA123garbage', '/search#wid=MLA123']) {
    globalThis.location = new URL(`https://www.mercadolibre.com.ar${path}`);
    assert.equal((await requestAffiliateLink()).ok, false);
  }
});
test('rejects unexpected or ambiguous responses', async () => {
  product();
  for (const data of [{ link: 'https://evil.test/link' }, { a: 'https://meli.la/a', b: 'https://meli.la/b' }, { link: 'https://meli.la/a?token=secret' }]) {
    globalThis.fetch = async () => Response.json(data);
    assert.equal((await requestAffiliateLink()).ok, false);
  }
  globalThis.fetch = async () => new Response('<html>login</html>');
  assert.equal((await requestAffiliateLink()).ok, false);
});
test('blocks concurrent submissions and releases lock on network failure', async () => {
  product();
  globalThis.__smartbrewAffiliateBusy = true;
  assert.match((await requestAffiliateLink()).message, /en curso/);
  globalThis.__smartbrewAffiliateBusy = false;
  globalThis.fetch = async () => { throw Error('private error'); };
  assert.equal((await requestAffiliateLink()).ok, false);
  assert.equal(globalThis.__smartbrewAffiliateBusy, false);
});
