import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./meta-api', () => ({ requestMeta: vi.fn() }));
import { requestMeta } from './meta-api';
import { adInput, adsConfig, createPausedAd } from './meta-ads';
const meta = vi.mocked(requestMeta);
const input = { productId: 'product', currency: 'ARS' as const, budgetMinor: 10000, days: 7, confirmed: true as const };
beforeEach(() => {
  vi.resetAllMocks();
  for (const [key, value] of Object.entries({ META_ADS_ENABLED: 'true', META_ADS_ACCESS_TOKEN: 'secret', META_ADS_ACCOUNT_ID: '123', META_ADS_PAGE_ID: '456', META_ADS_INSTAGRAM_ID: '789' })) vi.stubEnv(key, value);
  meta.mockResolvedValueOnce({ currency: 'ARS', account_status: 1 })
    .mockResolvedValueOnce({ id: '1' }).mockResolvedValueOnce({ id: '2' }).mockResolvedValueOnce({ id: '3' }).mockResolvedValueOnce({ id: '4' });
});
afterEach(() => vi.unstubAllEnvs());
it('requires explicit configuration and refuses activation by default', () => {
  vi.stubEnv('META_ADS_ENABLED', '');
  expect(adsConfig).toThrow();
});
it('validates budget, currency, duration and confirmation', () => {
  for (const change of [{ confirmed: false }, { budgetMinor: -1 }, { budgetMinor: 101.1 }, { days: 0 }, { days: 31 }, { currency: 'JPY' }]) expect(adInput.safeParse({ ...input, ...change }).success).toBe(false);
});
it('creates only paused delivery entities and persists IDs after each step', async () => {
  const save = vi.fn();
  await createPausedAd(input, { title: 'Cafetera', primaryImageUrl: 'https://http2.mlstatic.com/image.jpg' }, save);
  const bodies = meta.mock.calls.slice(1).map(call => Object.fromEntries(call[2].body as URLSearchParams));
  expect(bodies[0].status).toBe('PAUSED');
  expect(bodies[1]).toMatchObject({ status: 'PAUSED', lifetime_budget: '10000', campaign_id: '1' });
  expect(JSON.parse(bodies[1].targeting).publisher_platforms).toEqual(['instagram']);
  expect(Number(bodies[1].end_time) - Number(bodies[1].start_time)).toBe(7 * 86400);
  const story = JSON.parse(bodies[2].object_story_spec);
  expect(story.link_data.link).toBe('https://www.smartbrew.tech/productos/product');
  expect(story.link_data.call_to_action.type).toBe('SHOP_NOW');
  expect(story.instagram_user_id).toBe('789');
  expect(bodies[3]).toMatchObject({ status: 'PAUSED', adset_id: '2' });
  expect(save).toHaveBeenCalledTimes(4);
  expect(save).toHaveBeenLastCalledWith({ campaigns: '1', adsets: '2', adcreatives: '3', ads: '4' });
});
it('does not create remote entities on a currency mismatch', async () => {
  meta.mockReset().mockResolvedValue({ currency: 'USD', account_status: 1 });
  await expect(createPausedAd(input, { title: 'Cafetera', primaryImageUrl: 'image' }, vi.fn())).rejects.toThrow('moneda');
  expect(meta).toHaveBeenCalledTimes(1);
});
it('stops after an uncertain creation rather than duplicating it', async () => {
  meta.mockReset().mockResolvedValueOnce({ currency: 'ARS', account_status: 1 }).mockRejectedValueOnce(Error('timeout'));
  await expect(createPausedAd(input, { title: 'Cafetera', primaryImageUrl: 'image' }, vi.fn())).rejects.toThrow();
  expect(meta).toHaveBeenCalledTimes(2);
});
it('stops when an ID cannot be saved', async () => {
  await expect(createPausedAd(input, { title: 'Cafetera', primaryImageUrl: 'image' }, async () => { throw Error('db offline'); })).rejects.toThrow();
  expect(meta).toHaveBeenCalledTimes(2);
});
