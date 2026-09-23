import { createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { facebookInfoComments, facebookProductId, isFacebookInfo, verifyFacebookSignature } from './facebook-comments';
afterEach(() => vi.unstubAllEnvs());
it('matches only Info, ignoring case and surrounding whitespace', () => {
  for (const value of ['Info', 'INFO', ' info ']) expect(isFacebookInfo(value)).toBe(true);
  for (const value of ['quiero', 'precio', 'más info', 'Info!', '', null]) expect(isFacebookInfo(value)).toBe(false);
});
it('requires an untampered HMAC and configured secret', () => {
  const raw = '{"object":"page"}';
  const signature = `sha256=${createHmac('sha256', 'secret').update(raw).digest('hex')}`;
  expect(verifyFacebookSignature(raw, signature, 'secret')).toBe(true);
  expect(verifyFacebookSignature(raw + ' ', signature, 'secret')).toBe(false);
  expect(verifyFacebookSignature(raw, signature, '')).toBe(false);
  expect(verifyFacebookSignature(raw, 'invalid', 'secret')).toBe(false);
});
it('filters other pages, edits, own comments, reactions and non-keywords', () => {
  const value = { item: 'comment', verb: 'add', message: 'Info', post_id: '123_456', comment_id: '789', from: { id: '999' } };
  const body = (v = value, id = '123') => ({ object: 'page', entry: [{ id, changes: [{ field: 'feed', value: v }] }] });
  expect(facebookInfoComments(body(), '123')).toEqual([{ pageId: '123', postId: '123_456', commentId: '789' }]);
  for (const patch of [{ verb: 'edited' }, { item: 'reaction' }, { message: 'precio' }, { from: { id: '123' } }, { post_id: '999_456' }]) {
    expect(facebookInfoComments(body({ ...value, ...patch }), '123')).toEqual([]);
  }
  expect(facebookInfoComments(body(value, '999'), '123')).toEqual([]);
  expect(facebookInfoComments(null, '123')).toEqual([]);
});
it('requires explicit numeric post mapping, never a pfbid guess', () => {
  vi.stubEnv('FACEBOOK_POST_PRODUCT_MAP', '{"123_456":"product"}');
  expect(facebookProductId('123_456')).toBe('product');
  expect(facebookProductId('123_999')).toBeUndefined();
  vi.stubEnv('FACEBOOK_POST_PRODUCT_MAP', '{"pfbid123":"product"}');
  expect(() => facebookProductId('123_456')).toThrow();
});
